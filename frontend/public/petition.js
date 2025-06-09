document.addEventListener('DOMContentLoaded', function() {
    // API 연결 상태 확인
    if (typeof window.APIService === 'undefined') {
        console.error('❌ APIService를 찾을 수 없습니다. global_sync.js가 로드되었는지 확인하세요.');
        showErrorMessage('API 서비스 연결 실패');
        return;
    }

    // 페이지네이션 설정
    const ITEMS_PER_PAGE = 10;
    let currentPage = 1;
    let filteredData = [];
    let allPetitionData = [];
    let petitionIntroducers = [];

    // 상태별 한국어 매핑
    const statusMap = {
        'pending': '접수',
        'review': '심사중',
        'committee': '위원회 회부',
        'complete': '처리완료',
        'rejected': '폐기',
        'disapproved': '불채택',
        'withdrawn': '철회',
        'terminated': '종료'
    };

    // 상태별 CSS 클래스 매핑
    const statusClassMap = {
        'pending': 'status-pending',
        'review': 'status-review',
        'committee': 'status-committee',
        'complete': 'status-complete',
        'rejected': 'status-rejected',
        'disapproved': 'status-disapproved',
        'withdrawn': 'status-committee',
        'terminated': 'status-complete'
    };

    // 로딩 상태 표시
    function showLoading() {
        const tableBody = document.getElementById('petitionTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px;">
                        <div style="color: var(--example);">
                            📋 청원 데이터를 불러오는 중...
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    // 에러 메시지 표시
    function showErrorMessage(message) {
        const tableBody = document.getElementById('petitionTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: #f44336;">
                        ❌ ${message}
                        <br><br>
                        <button onclick="loadPetitionData()" style="
                            padding: 8px 16px; 
                            border: 1px solid var(--light-blue); 
                            background: white; 
                            color: var(--light-blue); 
                            border-radius: 5px; 
                            cursor: pointer;
                        ">다시 시도</button>
                    </td>
                </tr>
            `;
        }
    }

    // 빈 데이터 메시지 표시
    function showEmptyMessage() {
        const tableBody = document.getElementById('petitionTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: var(--example);">
                        📝 검색 조건에 맞는 청원이 없습니다.
                    </td>
                </tr>
            `;
        }
    }

    // 청원 제목 기반 위원회 추정
    function estimateCommittee(petitionTitle) {
        if (!petitionTitle) return '기타위원회';
        
        const title = petitionTitle.toLowerCase();
        
        // 키워드 기반 위원회 매핑
        const committeeMap = {
            '교육': '교육위원회',
            '학교': '교육위원회',
            '대학': '교육위원회',
            '경제': '기획재정위원회',
            '예산': '기획재정위원회',
            '세금': '기획재정위원회',
            '환경': '환경노동위원회',
            '노동': '환경노동위원회',
            '근로': '환경노동위원회',
            '의료': '보건복지위원회',
            '복지': '보건복지위원회',
            '건강': '보건복지위원회',
            '교통': '국토교통위원회',
            '건설': '국토교통위원회',
            '국토': '국토교통위원회',
            '문화': '문화체육관광위원회',
            '관광': '문화체육관광위원회',
            '체육': '문화체육관광위원회',
            '농업': '농림축산식품해양수산위원회',
            '축산': '농림축산식품해양수산위원회',
            '수산': '농림축산식품해양수산위원회',
            '해양': '농림축산식품해양수산위원회',
            '과학': '과학기술정보방송통신위원회',
            '기술': '과학기술정보방송통신위원회',
            '통신': '과학기술정보방송통신위원회',
            '인터넷': '과학기술정보방송통신위원회',
            '국방': '국방위원회',
            '군사': '국방위원회',
            '외교': '외교통일위원회',
            '통일': '외교통일위원회',
            '안전': '행정안전위원회',
            '행정': '행정안전위원회',
            '법무': '법제사법위원회',
            '사법': '법제사법위원회',
            '정보': '정보위원회',
            '여성': '여성가족위원회',
            '가족': '여성가족위원회',
            '아동': '여성가족위원회'
        };

        for (const [keyword, committee] of Object.entries(committeeMap)) {
            if (title.includes(keyword)) {
                return committee;
            }
        }

        return '기타위원회';
    }

    // API 상태를 내부 상태로 변환
    function normalizeStatus(procResultCd) {
        if (!procResultCd) return 'pending';
        
        const status = procResultCd.toLowerCase();
        
        // API 상태 코드 매핑
        const statusMapping = {
            '접수': 'pending',
            '심사중': 'review',
            '위원회회부': 'committee',
            '위원회 회부': 'committee',
            '처리완료': 'complete',
            '폐기': 'rejected',
            '불채택': 'disapproved',
            '철회': 'withdrawn',
            '종료': 'terminated',
            '본회의불부의': 'rejected'
        };
        
        return statusMapping[status] || statusMapping[procResultCd] || 'pending';
    }

    // API 날짜 형식을 화면 표시용으로 변환
    function formatApiDate(dateString) {
        if (!dateString) return '-';
        
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            
            return date.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        } catch (error) {
            console.warn('날짜 변환 실패:', dateString);
            return dateString;
        }
    }

    // 제안자 정보 포맷팅
    function formatProposer(proposer) {
        if (!proposer) return '미상';
        
        // 제안자 정보를 깔끔하게 정리
        const cleanProposer = proposer.toString().trim();
        
        // 너무 긴 경우 줄임
        if (cleanProposer.length > 20) {
            return cleanProposer.substring(0, 17) + '...';
        }
        
        return cleanProposer;
    }

    // API에서 청원 데이터 및 소개의원 데이터 로드
    async function loadPetitionData() {
        try {
            showLoading();
            console.log('📋 청원 데이터 로딩 시작...');

            // 두 API를 병렬로 호출
            const [petitionsResponse, introducersResponse] = await Promise.all([
                window.APIService.getPetitions(),
                window.APIService.getPetitionIntroducers()
            ]);

            console.log('✅ 청원 API 응답:', petitionsResponse);
            console.log('✅ 청원 소개의원 API 응답:', introducersResponse);

            // 데이터 변환 및 저장
            allPetitionData = transformPetitionData(petitionsResponse);
            petitionIntroducers = introducersResponse || [];
            filteredData = [...allPetitionData];

            console.log(`📊 총 ${allPetitionData.length}건의 청원 데이터 로드 완료`);
            console.log(`👥 총 ${petitionIntroducers.length}명의 소개의원 데이터 로드 완료`);

            // 초기 렌더링
            currentPage = 1;
            renderPetitionTable(filteredData, currentPage);

            // 성공 알림
            if (window.APIService.showNotification) {
                window.APIService.showNotification(
                    `청원 데이터 ${allPetitionData.length}건 로드 완료`, 
                    'success'
                );
            }

        } catch (error) {
            console.error('❌ 청원 데이터 로드 실패:', error);
            showErrorMessage('청원 데이터를 불러올 수 없습니다');
            
            if (window.APIService.showNotification) {
                window.APIService.showNotification('청원 데이터 로드 실패', 'error');
            }
        }
    }

    // API 데이터를 화면 표시용 형식으로 변환
    function transformPetitionData(apiData) {
        if (!Array.isArray(apiData)) {
            console.warn('⚠️ 청원 API 응답이 배열이 아닙니다:', apiData);
            return [];
        }

        return apiData.map((item, index) => {
            const petitionId = item.BILL_NO || `petition_${index + 1}`;
            const title = item.BILL_NAME || '제목 없음';
            const proposer = formatProposer(item.PROPOSER);
            const introduceDate = formatApiDate(item.PROPOSE_DT);
            const status = normalizeStatus(item.PROC_RESULT_CD);
            const committee = estimateCommittee(title);
            
            return {
                id: petitionId,
                number: item.BILL_NO || '',
                title: title,
                proposer: proposer,
                introducerMember: proposer, // 호환성을 위해 유지
                introduceDate: introduceDate,
                referralDate: introduceDate, // 회부일은 접수일과 동일하게 처리
                status: status,
                committee: committee,
                link: item.LINK_URL || '',
                procResult: item.PROC_RESULT_CD || '',
                rawData: item // 원본 데이터 보관
            };
        });
    }

    // 소개의원 정보 조회
    function getIntroducerInfo(memberName) {
        const introducer = petitionIntroducers.find(
            intro => intro.introducer_name === memberName
        );
        return introducer ? introducer.petition : 0;
    }

    // 페이지 변경 함수 (전역으로 노출)
    window.changePage = function(page) {
        currentPage = page;
        renderPetitionTable(filteredData, currentPage);
        
        // 페이지 상단으로 스크롤
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // 청원 테이블 렌더링
    function renderPetitionTable(data, page = 1) {
        const tableBody = document.getElementById('petitionTableBody');
        const totalCountElement = document.getElementById('totalCount');
        
        if (!tableBody) return;

        // 데이터가 없는 경우
        if (!data || data.length === 0) {
            showEmptyMessage();
            
            if (totalCountElement) {
                totalCountElement.textContent = '0';
            }
            
            // 페이지네이션 숨김
            const pagination = document.getElementById('pagination');
            if (pagination) {
                pagination.style.display = 'none';
            }
            return;
        }

        // 페이지에 해당하는 데이터 추출
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const pageData = data.slice(startIndex, endIndex);

        // 전체 건수 업데이트
        if (totalCountElement) {
            totalCountElement.textContent = window.formatNumber ? 
                window.formatNumber(data.length) : data.length.toLocaleString();
        }

        // 기존 내용 초기화
        tableBody.innerHTML = '';

        // 각 청원 데이터로 행 생성
        pageData.forEach((petition, index) => {
            const row = document.createElement('tr');
            const globalIndex = startIndex + index + 1;
            const statusText = statusMap[petition.status] || petition.status;
            const statusClass = statusClassMap[petition.status] || 'status-pending';

            // 상태에 따른 행 클래스 추가
            if (petition.status === 'complete') {
                row.classList.add('status-complete');
            } else if (petition.status === 'rejected') {
                row.classList.add('status-rejected');
            } else if (petition.status === 'disapproved') {
                row.classList.add('status-disapproved');
            }

            // 제목 줄임 처리
            const displayTitle = petition.title.length > 50 ? 
                petition.title.substring(0, 47) + '...' : petition.title;

            // 위원회명 줄임 처리
            const displayCommittee = petition.committee.length > 15 ? 
                petition.committee.substring(0, 12) + '...' : petition.committee;

            // 행 HTML 생성
            row.innerHTML = `
                <td>${globalIndex}</td>
                <td>
                    <span class="petition-title" title="${petition.title}">
                        ${displayTitle}
                    </span>
                </td>
                <td>
                    <span class="member-name" title="${petition.proposer}">
                        ${petition.proposer}
                    </span>
                </td>
                <td>${petition.introduceDate}</td>
                <td>${petition.referralDate}</td>
                <td>
                    <span class="status-badge ${statusClass}" title="${petition.procResult}">
                        ${statusText}
                    </span>
                </td>
                <td>
                    <span class="committee-name" title="${petition.committee}">
                        ${displayCommittee}
                    </span>
                </td>
            `;

            // 행 전체에 클릭 이벤트 추가
            row.addEventListener('click', function() {
                showPetitionDetail(petition.id);
            });

            // 호버 효과를 위한 스타일 추가
            row.style.cursor = 'pointer';

            tableBody.appendChild(row);
        });

        // 페이지네이션 업데이트
        if (window.createPagination) {
            window.createPagination(data.length, page, ITEMS_PER_PAGE, window.changePage);
        }
    }

    // 청원 상세 페이지로 이동 (전역 함수)
    window.showPetitionDetail = function(petitionId) {
        console.log(`청원 [${petitionId}] 상세 페이지로 이동`);
        
        // 청원 상세 페이지로 이동 (URL 파라미터로 전달)
        window.location.href = `more_petition.html?petition_id=${encodeURIComponent(petitionId)}`;
    };

    // 검색 기능
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');

    function performSearch() {
        const searchTerm = searchInput.value.trim().toLowerCase();
        
        if (searchTerm === '') {
            filteredData = [...allPetitionData];
        } else {
            filteredData = allPetitionData.filter(petition => 
                petition.title.toLowerCase().includes(searchTerm) ||
                petition.proposer.toLowerCase().includes(searchTerm) ||
                petition.committee.toLowerCase().includes(searchTerm) ||
                petition.number.toLowerCase().includes(searchTerm)
            );
        }
        
        currentPage = 1;
        renderPetitionTable(filteredData, currentPage);

        console.log(`🔍 검색 결과: "${searchTerm}" - ${filteredData.length}건`);
    }

    if (searchButton) {
        searchButton.addEventListener('click', performSearch);
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });

        // 실시간 검색 (디바운스 적용)
        if (window.debounce) {
            const debouncedSearch = window.debounce(performSearch, 300);
            searchInput.addEventListener('input', debouncedSearch);
        }
    }

    // 필터 기능
    const statusFilter = document.getElementById('statusFilter');
    const periodFilter = document.getElementById('periodFilter');

    function applyFilters() {
        let filtered = [...allPetitionData];

        // 상태 필터
        const selectedStatus = statusFilter?.value;
        if (selectedStatus && selectedStatus !== 'all') {
            filtered = filtered.filter(petition => petition.status === selectedStatus);
        }

        // 기간 필터
        const selectedPeriod = periodFilter?.value;
        if (selectedPeriod && selectedPeriod !== 'all') {
            const now = new Date();
            const cutoffDate = new Date();
            
            switch(selectedPeriod) {
                case 'month1':
                    cutoffDate.setMonth(now.getMonth() - 1);
                    break;
                case 'month3':
                    cutoffDate.setMonth(now.getMonth() - 3);
                    break;
                case 'month6':
                    cutoffDate.setMonth(now.getMonth() - 6);
                    break;
                case 'year1':
                    cutoffDate.setFullYear(now.getFullYear() - 1);
                    break;
            }
            
            filtered = filtered.filter(petition => {
                try {
                    const petitionDate = new Date(petition.introduceDate);
                    return petitionDate >= cutoffDate;
                } catch (error) {
                    console.warn('날짜 필터링 오류:', petition.introduceDate);
                    return true; // 날짜 파싱 실패 시 포함
                }
            });
        }

        filteredData = filtered;
        currentPage = 1;
        renderPetitionTable(filteredData, currentPage);

        console.log(`🔧 필터 적용: 상태=${selectedStatus}, 기간=${selectedPeriod} - ${filteredData.length}건`);
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', applyFilters);
    }

    if (periodFilter) {
        periodFilter.addEventListener('change', applyFilters);
    }

    // 전역 함수로 데이터 새로고침 기능 제공
    window.loadPetitionData = loadPetitionData;

    // 페이지 로드 시 데이터 로드
    loadPetitionData();

    console.log('✅ 청원 현황 페이지 초기화 완료 (API 연결 v2.0)');
});
