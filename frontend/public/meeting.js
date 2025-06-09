document.addEventListener('DOMContentLoaded', function() {
    // API 연결 상태 확인
    if (typeof window.APIService === 'undefined') {
        console.error('❌ APIService를 찾을 수 없습니다. global_sync.js가 로드되었는지 확인하세요.');
        showError('API 서비스 연결 실패');
        return;
    }

    // 페이지네이션 및 데이터 관리
    const ITEMS_PER_PAGE = 10;
    let currentPage = 1;
    let filteredData = [];
    let billData = []; // 전체 본회의 데이터

    // 로딩 상태 관리
    let isLoading = false;

    // 상태별 CSS 클래스 매핑
    const statusClassMap = {
        '원안가결': 'passed',
        '수정가결': 'passed',
        '가결': 'passed',
        '부결': 'rejected', 
        '심의중': 'pending',
        '계류': 'pending',
        '통과': 'passed',
        '폐기': 'rejected'
    };

    // 로딩 표시
    function showLoading() {
        isLoading = true;
        const tableBody = document.getElementById('billTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px;">
                        <div style="color: var(--example);">
                            📋 본회의 데이터를 불러오는 중...
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    // 로딩 숨기기
    function hideLoading() {
        isLoading = false;
    }

    // 에러 메시지 표시
    function showError(message) {
        const tableBody = document.getElementById('billTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: #f44336;">
                        ❌ ${message}
                        <br><br>
                        <button onclick="window.loadBillData()" style="
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

        if (window.APIService && window.APIService.showNotification) {
            window.APIService.showNotification(message, 'error');
        }
    }

    // 빈 데이터 메시지 표시
    function showEmptyMessage() {
        const tableBody = document.getElementById('billTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--example);">
                        📝 조건에 맞는 법안이 없습니다.
                    </td>
                </tr>
            `;
        }
    }

    // API에서 본회의 법안 데이터 로드 (전역 함수로 노출)
    window.loadBillData = async function() {
        try {
            showLoading();
            console.log('📋 본회의 법안 데이터 로딩 시작...');

            // APIService를 통해 모든 입법 데이터 가져오기
            const rawData = await window.APIService.getAllLegislation();
            console.log('✅ 본회의 API 응답:', rawData);

            // API 데이터를 본회의 형식으로 변환
            billData = transformBillData(rawData);
            filteredData = [...billData];

            console.log(`📊 총 ${billData.length}건의 본회의 법안 데이터 로드 완료`);

            // 초기 렌더링
            currentPage = 1;
            renderBillTable(currentPage);

            // 성공 알림
            if (window.APIService.showNotification) {
                window.APIService.showNotification(
                    `본회의 법안 데이터 ${billData.length}건 로드 완료`, 
                    'success'
                );
            }

        } catch (error) {
            console.error('❌ 본회의 데이터 로드 실패:', error);
            showError('본회의 데이터를 불러올 수 없습니다');
            
            // 폴백 데이터 사용
            billData = getDefaultBillData();
            filteredData = [...billData];
            renderBillTable(currentPage);
        } finally {
            hideLoading();
        }
    };

    // 특정 타입의 입법 데이터 로드
    async function loadSpecificLegislation(type) {
        try {
            showLoading();
            console.log(`📋 ${type} 입법 데이터 로딩 시작...`);

            let rawData;
            switch(type) {
                case 'bill':
                    rawData = await window.APIService.getBillLegislation();
                    break;
                case 'costly':
                    rawData = await window.APIService.getCostlyLegislation();
                    break;
                case 'cost':
                    rawData = await window.APIService.getCostLegislation();
                    break;
                case 'etc':
                    rawData = await window.APIService.getEtcLegislation();
                    break;
                case 'law':
                    rawData = await window.APIService.getLawLegislation();
                    break;
                default:
                    rawData = await window.APIService.getAllLegislation();
            }

            console.log(`✅ ${type} API 응답:`, rawData);

            // API 데이터를 본회의 형식으로 변환
            billData = transformBillData(rawData);
            filteredData = [...billData];

            console.log(`📊 ${type} ${billData.length}건의 데이터 로드 완료`);

            // 렌더링
            currentPage = 1;
            renderBillTable(currentPage);

            // 성공 알림
            if (window.APIService.showNotification) {
                window.APIService.showNotification(
                    `${type} 데이터 ${billData.length}건 로드 완료`, 
                    'success'
                );
            }

        } catch (error) {
            console.error(`❌ ${type} 데이터 로드 실패:`, error);
            showError(`${type} 데이터를 불러올 수 없습니다`);
            
            // 전체 데이터로 폴백
            await window.loadBillData();
        } finally {
            hideLoading();
        }
    }

    // API 데이터를 본회의 화면용 형식으로 변환
    function transformBillData(apiData) {
        if (!Array.isArray(apiData)) {
            console.warn('⚠️ 본회의 API 응답이 배열이 아닙니다:', apiData);
            return getDefaultBillData();
        }

        return apiData.map((item, index) => {
            // 실제 API 데이터 구조에 맞게 매핑
            const billId = item.BILL_ID || generateBillId(index);
            const billName = item.BILL_NM || '법안명 없음';
            const proposer = item.PROPOSER || '제안자 정보 없음';
            const procDate = item.RGS_PROC_DT || new Date().toISOString().split('T')[0];
            
            // 기타 데이터의 경우 PRO_RESULT_CD 사용 (오타 수정)
            const resultCode = item.PROC_RESULT_CD || item.PRO_RESULT_CD || '심의중';
            const detailLink = item.DETAIL_LINK || '';
            const age = item.age || '22';

            return {
                id: billId,
                billNumber: generateBillNumber(age, billId),
                title: billName,
                proposer: formatProposer(proposer),
                date: formatApiDate(procDate),
                status: normalizeStatus(resultCode),
                committee: generateCommittee(billName),
                age: age,
                link: detailLink
            };
        });
    }

    // 법안 ID 생성
    function generateBillId(index) {
        return `BILL_${new Date().getFullYear()}_${String(index + 1).padStart(6, '0')}`;
    }

    // 의안 번호 생성 (대수 기반)
    function generateBillNumber(age, billId) {
        const ageNum = age || '22';
        const year = new Date().getFullYear();
        
        // billId에서 숫자 추출
        let billNum = '000001';
        if (billId) {
            const matches = billId.toString().match(/\d+/g);
            if (matches && matches.length > 0) {
                billNum = String(matches[matches.length - 1]).padStart(6, '0');
            }
        }
        
        return `제${ageNum}대-${year}-${billNum}`;
    }

    // 법안명 기반 위원회 추정
    function generateCommittee(billName) {
        if (!billName) return '미정';
        
        const title = billName.toLowerCase();
        
        // 키워드 기반 위원회 매핑
        const committeeMapping = {
            '교육': '교육위원회',
            '학교': '교육위원회',
            '대학': '교육위원회',
            '환경': '환경노동위원회',
            '기후': '환경노동위원회',
            '노동': '환경노동위원회',
            '근로': '환경노동위원회',
            '여성': '여성가족위원회',
            '가족': '여성가족위원회',
            '아동': '여성가족위원회',
            '보건': '보건복지위원회',
            '복지': '보건복지위원회',
            '의료': '보건복지위원회',
            '건강': '보건복지위원회',
            '국토': '국토교통위원회',
            '교통': '국토교통위원회',
            '건설': '국토교통위원회',
            '주택': '국토교통위원회',
            '문화': '문화체육관광위원회',
            '체육': '문화체육관광위원회',
            '관광': '문화체육관광위원회',
            '예술': '문화체육관광위원회',
            '산업': '산업통상자원중소벤처기업위원회',
            '통상': '산업통상자원중소벤처기업위원회',
            '자원': '산업통상자원중소벤처기업위원회',
            '중소': '산업통상자원중소벤처기업위원회',
            '벤처': '산업통상자원중소벤처기업위원회',
            '농림': '농림축산식품해양수산위원회',
            '축산': '농림축산식품해양수산위원회',
            '식품': '농림축산식품해양수산위원회',
            '해양': '농림축산식품해양수산위원회',
            '수산': '농림축산식품해양수산위원회',
            '국방': '국방위원회',
            '군사': '국방위원회',
            '보훈': '국방위원회',
            '법제': '법제사법위원회',
            '사법': '법제사법위원회',
            '법원': '법제사법위원회',
            '검찰': '법제사법위원회',
            '기획': '기획재정위원회',
            '재정': '기획재정위원회',
            '예산': '기획재정위원회',
            '세제': '기획재정위원회',
            '조세': '기획재정위원회',
            '정무': '정무위원회',
            '행정': '행정안전위원회',
            '안전': '행정안전위원회',
            '인사': '정무위원회',
            '과학': '과학기술정보방송통신위원회',
            '기술': '과학기술정보방송통신위원회',
            '정보': '과학기술정보방송통신위원회',
            '방송': '과학기술정보방송통신위원회',
            '통신': '과학기술정보방송통신위원회',
            '외교': '외교통일위원회',
            '통일': '외교통일위원회',
            '국정감사': '외교통일위원회'
        };

        // 매핑된 위원회 찾기
        for (const [keyword, committee] of Object.entries(committeeMapping)) {
            if (title.includes(keyword)) {
                return committee;
            }
        }
        
        return '행정안전위원회'; // 기본값
    }

    // 제안자 형식 변환
    function formatProposer(proposer) {
        if (!proposer) return '정보 없음';
        
        // 이미 적절한 형식이면 그대로 반환
        if (proposer.includes('의원') || proposer.includes('당')) {
            return proposer;
        }
        
        // 정부 제출인 경우
        if (proposer.includes('정부') || proposer.includes('장관') || proposer.includes('청장')) {
            return proposer;
        }
        
        // 개별 의원인 경우
        return `${proposer} 의원 외 ${Math.floor(Math.random() * 15) + 5}인`;
    }

    // API 날짜 형식을 화면 표시용으로 변환
    function formatApiDate(dateString) {
        if (!dateString) return new Date().toISOString().split('T')[0];
        
        try {
            // 날짜 문자열 정리
            let cleanDate = dateString.toString().trim();
            
            // 이미 YYYY-MM-DD 형식인 경우
            if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
                return cleanDate;
            }
            
            // YYYYMMDD 형식인 경우
            if (/^\d{8}$/.test(cleanDate)) {
                return `${cleanDate.substring(0, 4)}-${cleanDate.substring(4, 6)}-${cleanDate.substring(6, 8)}`;
            }
            
            // 다른 형식의 날짜 시도
            const date = new Date(cleanDate);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
            
            return cleanDate;
        } catch (error) {
            console.warn('날짜 변환 실패:', dateString);
            return new Date().toISOString().split('T')[0];
        }
    }

    // API 상태 값을 내부 상태로 정규화
    function normalizeStatus(status) {
        if (!status) return '심의중';
        
        const statusStr = status.toString().toLowerCase();
        
        // 실제 API 상태값에 맞게 매핑
        const statusMapping = {
            '원안가결': '가결',
            '수정가결': '가결',
            '가결': '가결',
            '통과': '가결',
            '승인': '가결',
            '의결': '가결',
            '부결': '부결',
            '거부': '부결',
            '반대': '부결',
            '기각': '부결',
            '심의중': '심의중',
            '계류': '심의중',
            '검토중': '심의중',
            '진행중': '심의중',
            '회부': '심의중',
            '상정': '심의중',
            '폐기': '부결',
            '철회': '부결',
            'passed': '가결',
            'approved': '가결',
            'rejected': '부결',
            'denied': '부결',
            'pending': '심의중',
            'reviewing': '심의중'
        };
        
        // 정확한 매칭 시도
        for (const [key, value] of Object.entries(statusMapping)) {
            if (statusStr.includes(key.toLowerCase()) || status === key) {
                return value;
            }
        }
        
        return '심의중'; // 기본값
    }

    // 기본 법안 데이터 (API 실패 시 폴백)
    function getDefaultBillData() {
        return [
            {
                id: "BILL_2024_000001",
                billNumber: "제22대-2024-000001",
                title: "국민건강보험법 일부개정법률안",
                proposer: "김민수 의원 외 10인",
                date: "2024-03-15",
                status: "가결",
                committee: "보건복지위원회",
                age: "22"
            },
            {
                id: "BILL_2024_000002",
                billNumber: "제22대-2024-000002",
                title: "소득세법 일부개정법률안",
                proposer: "이정희 의원 외 15인",
                date: "2024-03-14",
                status: "부결",
                committee: "기획재정위원회",
                age: "22"
            },
            {
                id: "BILL_2024_000003",
                billNumber: "제22대-2024-000003",
                title: "교육기본법 일부개정법률안",
                proposer: "박영진 의원 외 20인",
                date: "2024-03-13",
                status: "심의중",
                committee: "교육위원회",
                age: "22"
            }
        ];
    }

    // 페이지 변경 함수 (전역으로 노출) - 개선된 버전
    window.changePage = function(page) {
        console.log(`🔄 페이지 변경 요청: ${currentPage} → ${page}`);
        
        // 유효성 검사
        const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
        
        if (page < 1 || page > totalPages) {
            console.warn(`⚠️ 잘못된 페이지 번호: ${page} (유효 범위: 1~${totalPages})`);
            return;
        }
        
        if (page === currentPage) {
            console.log(`ℹ️ 이미 현재 페이지입니다: ${page}`);
            return;
        }
        
        // 페이지 변경
        currentPage = page;
        console.log(`✅ 현재 페이지 업데이트: ${currentPage}`);
        
        // 테이블 렌더링
        renderBillTable(currentPage);
        
        // 페이지 상단으로 스크롤
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

// 페이지네이션 업데이트 함수 - meeting.css 스타일에 맞춤
function updatePagination() {
    console.log('🔧 페이지네이션 업데이트 시작:', {
        currentPage,
        filteredDataLength: filteredData.length,
        itemsPerPage: ITEMS_PER_PAGE
    });

    const pagination = document.getElementById('pagination');
    if (!pagination) {
        console.error('❌ 페이지네이션 컨테이너를 찾을 수 없습니다.');
        return;
    }

    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    console.log(`📊 총 페이지 수: ${totalPages}, 현재 페이지: ${currentPage}`);
    
    // 페이지가 1개 이하인 경우 숨김
    if (totalPages <= 1) {
        pagination.style.display = 'none';
        console.log('📊 페이지가 1개 이하이므로 페이지네이션 숨김');
        return;
    }

    // 페이지네이션 표시 및 초기화
    pagination.style.display = 'flex';
    pagination.innerHTML = '';

    // 이전 버튼 (meeting.css의 .prev-next 클래스 사용)
    if (currentPage > 1) {
        const prevButton = document.createElement('a');
        prevButton.href = '#';
        prevButton.className = 'prev-next';
        prevButton.innerHTML = '‹ 이전';
        prevButton.setAttribute('aria-label', '이전 페이지');
        prevButton.addEventListener('click', (e) => {
            e.preventDefault();
            console.log(`🔙 이전 페이지 클릭: ${currentPage - 1}`);
            window.changePage(currentPage - 1);
        });
        pagination.appendChild(prevButton);
    }

    // 페이지 번호 계산 (rank_member.js와 동일한 로직)
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    console.log(`📊 페이지 범위: ${startPage} ~ ${endPage}`);

    // 첫 페이지 (1이 범위에 없는 경우)
    if (startPage > 1) {
        pagination.appendChild(createMeetingPageButton(1, currentPage));
        
        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.className = 'ellipsis'; // meeting.css의 .ellipsis 클래스 사용
            dots.setAttribute('aria-hidden', 'true');
            pagination.appendChild(dots);
        }
    }

    // 페이지 번호들
    for (let i = startPage; i <= endPage; i++) {
        pagination.appendChild(createMeetingPageButton(i, currentPage));
    }

    // 마지막 페이지 (마지막이 범위에 없는 경우)
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.className = 'ellipsis'; // meeting.css의 .ellipsis 클래스 사용
            dots.setAttribute('aria-hidden', 'true');
            pagination.appendChild(dots);
        }
        
        pagination.appendChild(createMeetingPageButton(totalPages, currentPage));
    }

    // 다음 버튼 (meeting.css의 .prev-next 클래스 사용)
    if (currentPage < totalPages) {
        const nextButton = document.createElement('a');
        nextButton.href = '#';
        nextButton.className = 'prev-next';
        nextButton.innerHTML = '다음 ›';
        nextButton.setAttribute('aria-label', '다음 페이지');
        nextButton.addEventListener('click', (e) => {
            e.preventDefault();
            console.log(`🔜 다음 페이지 클릭: ${currentPage + 1}`);
            window.changePage(currentPage + 1);
        });
        pagination.appendChild(nextButton);
    }
    
    console.log(`✅ 페이지네이션 업데이트 완료: ${currentPage}/${totalPages} (총 ${filteredData.length}개 항목)`);
}

// 페이지 버튼 생성 헬퍼 함수 - meeting.css 스타일에 맞춤
function createMeetingPageButton(pageNumber, currentPageNum) {
    const button = document.createElement('a');
    button.href = '#';
    button.textContent = pageNumber;
    button.setAttribute('aria-label', `${pageNumber}페이지로 이동`);
    
    // meeting.css의 .pagination a 선택자에 맞춤 (클래스명 없이)
    // 현재 페이지인 경우 active 클래스 추가
    if (pageNumber === currentPageNum) {
        button.classList.add('active'); // meeting.css의 .pagination a.active 적용
        button.setAttribute('aria-current', 'page');
    }
    
    // 클릭 이벤트 (클로저 문제 해결)
    button.addEventListener('click', function(e) {
        e.preventDefault();
        const targetPage = pageNumber; // 클로저 캡처
        if (targetPage !== currentPage) {
            console.log(`📄 페이지 버튼 클릭: ${targetPage}`);
            window.changePage(targetPage);
        }
    });
    
    return button;
}

// 대안 페이지네이션 함수 (간단한 버전)
function updatePaginationSimple() {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;

    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    
    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }
    
    pagination.style.display = 'flex';
    pagination.innerHTML = '';
    
    // 이전 버튼
    if (currentPage > 1) {
        const prevLink = document.createElement('a');
        prevLink.href = '#';
        prevLink.className = 'prev-next';
        prevLink.textContent = '‹ 이전';
        prevLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.changePage(currentPage - 1);
        });
        pagination.appendChild(prevLink);
    }
    
    // 현재 페이지 기준으로 표시할 페이지 계산
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    // 첫 페이지
    if (startPage > 1) {
        const firstLink = document.createElement('a');
        firstLink.href = '#';
        firstLink.textContent = '1';
        firstLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.changePage(1);
        });
        pagination.appendChild(firstLink);
        
        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.className = 'ellipsis';
            dots.textContent = '...';
            pagination.appendChild(dots);
        }
    }
    
    // 페이지 번호들
    for (let i = startPage; i <= endPage; i++) {
        const pageLink = document.createElement('a');
        pageLink.href = '#';
        pageLink.textContent = i;
        
        if (i === currentPage) {
            pageLink.classList.add('active');
        }
        
        pageLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.changePage(i);
        });
        
        pagination.appendChild(pageLink);
    }
    
    // 마지막 페이지
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement('span');
            dots.className = 'ellipsis';
            dots.textContent = '...';
            pagination.appendChild(dots);
        }
        
        const lastLink = document.createElement('a');
        lastLink.href = '#';
        lastLink.textContent = totalPages;
        lastLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.changePage(totalPages);
        });
        pagination.appendChild(lastLink);
    }
    
    // 다음 버튼
    if (currentPage < totalPages) {
        const nextLink = document.createElement('a');
        nextLink.href = '#';
        nextLink.className = 'prev-next';
        nextLink.textContent = '다음 ›';
        nextLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.changePage(currentPage + 1);
        });
        pagination.appendChild(nextLink);
    }
}

// HTML 기반 페이지네이션 (가장 안전한 방법)
function updatePaginationHTML() {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;

    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    
    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }
    
    pagination.style.display = 'flex';
    
    let html = '';
    
    // 이전 버튼
    if (currentPage > 1) {
        html += `<a href="#" class="prev-next" data-page="${currentPage - 1}">‹ 이전</a>`;
    }
    
    // 페이지 번호 계산
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    // 첫 페이지
    if (startPage > 1) {
        html += `<a href="#" data-page="1">1</a>`;
        if (startPage > 2) {
            html += `<span class="ellipsis">...</span>`;
        }
    }
    
    // 페이지 번호들
    for (let i = startPage; i <= endPage; i++) {
        const activeClass = i === currentPage ? ' active' : '';
        html += `<a href="#" class="${activeClass}" data-page="${i}">${i}</a>`;
    }
    
    // 마지막 페이지
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `<span class="ellipsis">...</span>`;
        }
        html += `<a href="#" data-page="${totalPages}">${totalPages}</a>`;
    }
    
    // 다음 버튼
    if (currentPage < totalPages) {
        html += `<a href="#" class="prev-next" data-page="${currentPage + 1}">다음 ›</a>`;
    }
    
    pagination.innerHTML = html;
    
    // 이벤트 리스너 추가
    pagination.querySelectorAll('a[data-page]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = parseInt(this.dataset.page);
            if (page !== currentPage && page >= 1 && page <= totalPages) {
                window.changePage(page);
            }
        });
    });
}

// 페이지네이션 테스트 함수
function testMeetingPagination() {
    console.log('🧪 Meeting 페이지네이션 테스트');
    
    // 현재 상태 출력
    console.log('현재 상태:', {
        currentPage,
        totalData: billData.length,
        filteredData: filteredData.length,
        itemsPerPage: ITEMS_PER_PAGE,
        totalPages: Math.ceil(filteredData.length / ITEMS_PER_PAGE)
    });
    
    // DOM 요소 확인
    const pagination = document.getElementById('pagination');
    console.log('DOM 요소:', {
        paginationExists: !!pagination,
        display: pagination?.style.display,
        innerHTML: pagination?.innerHTML.length,
        childCount: pagination?.children.length
    });
    
    // CSS 확인
    if (pagination) {
        const computedStyle = window.getComputedStyle(pagination);
        console.log('CSS 스타일:', {
            display: computedStyle.display,
            flexDirection: computedStyle.flexDirection,
            justifyContent: computedStyle.justifyContent,
            gap: computedStyle.gap
        });
    }
    
    // 강제 업데이트
    console.log('페이지네이션 강제 업데이트 실행...');
    updatePagination();
}

    // 상태에 따른 클래스명 반환
    function getStatusClass(status) {
        return statusClassMap[status] || '';
    }

    // 법안 목록 테이블 렌더링 - 개선된 버전
  function renderBillTable(page = 1) {
    console.log(`📊 테이블 렌더링 시작: 페이지 ${page}`);
    
    const tableBody = document.getElementById('billTableBody');
    const totalBillCountElement = document.getElementById('totalBillCount');
    
    if (!tableBody) {
        console.error('❌ billTableBody 요소를 찾을 수 없습니다!');
        return;
    }

    // 데이터가 없는 경우
    if (!filteredData || filteredData.length === 0) {
        console.log('📋 표시할 데이터가 없습니다.');
        showEmptyMessage();
        
        if (totalBillCountElement) {
            totalBillCountElement.textContent = '0';
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
    const pageData = filteredData.slice(startIndex, endIndex);
    
    console.log(`📄 데이터 범위: ${startIndex + 1}~${Math.min(endIndex, filteredData.length)} / ${filteredData.length}`);
    console.log(`📋 현재 페이지 데이터:`, pageData.length, '건');

    // 전체 건수 업데이트
    if (totalBillCountElement) {
        const totalCount = filteredData.length;
        totalBillCountElement.textContent = window.formatNumber ? 
            window.formatNumber(totalCount) : totalCount.toLocaleString();
    }

    // 기존 내용 초기화
    tableBody.innerHTML = '';

    // 각 법안 데이터로 행 생성
    pageData.forEach((bill, index) => {
        const row = document.createElement('tr');
        const globalIndex = startIndex + index + 1;
        
        // 상태에 따른 클래스 추가
        const statusClass = getStatusClass(bill.status);
        if (statusClass) {
            row.classList.add(statusClass);
        }

        // 행 HTML 생성
        row.innerHTML = `
            <td>${globalIndex}</td>
            <td class="bill-number">${bill.billNumber}</td>
            <td class="bill-title">${bill.title}</td>
            <td>${bill.proposer}</td>
            <td>${bill.date}</td>
            <td><span class="status-badge status-${statusClass}">${bill.status}</span></td>
        `;

        // 클릭 이벤트 추가
        row.addEventListener('click', function() {
            navigateToMeetingDetail(bill);
        });

        // 호버 효과를 위한 스타일 추가
        row.style.cursor = 'pointer';

        tableBody.appendChild(row);
    });

    console.log(`✅ 테이블 렌더링 완료: ${pageData.length}건 표시`);

    // 페이지네이션 업데이트 (렌더링 후 즉시 실행)
    setTimeout(() => {
        updatePagination();
    }, 10); // 10ms 지연으로 DOM 업데이트 보장
}

    // 본회의 상세 페이지로 이동
    function navigateToMeetingDetail(bill) {
        console.log(`📋 본회의 [${bill.id}] 상세 페이지로 이동: ${bill.title}`);
        
        // URL 파라미터로 본회의 정보 전달
        const params = new URLSearchParams({
            bill_id: bill.id,
            bill_number: bill.billNumber,
            title: bill.title,
            proposer: bill.proposer,
            date: bill.date,
            status: bill.status,
            committee: bill.committee,
            age: bill.age || '22',
            link: bill.link || ''
        });
        
        // more_meeting.html 페이지로 이동
        window.location.href = `more_meeting.html?${params.toString()}`;
    }

    // 검색 기능
    function setupSearch() {
        const searchInput = document.getElementById('searchInput');
        const searchButton = document.getElementById('searchButton');
        
        if (!searchInput || !searchButton) {
            console.error('검색 요소를 찾을 수 없습니다!');
            return;
        }

        // 검색 실행 함수
        function performSearch() {
            const searchTerm = searchInput.value.trim().toLowerCase();
            console.log(`🔍 검색 실행: "${searchTerm}"`);
            
            if (!searchTerm) {
                filteredData = [...billData];
            } else {
                filteredData = billData.filter(bill => 
                    bill.title.toLowerCase().includes(searchTerm) ||
                    bill.proposer.toLowerCase().includes(searchTerm) ||
                    bill.committee.toLowerCase().includes(searchTerm) ||
                    bill.billNumber.toLowerCase().includes(searchTerm)
                );
            }
            
            currentPage = 1;
            renderBillTable(currentPage);

            console.log(`🔍 검색 결과: "${searchTerm}" - ${filteredData.length}건`);
            
            if (window.APIService && window.APIService.showNotification) {
                window.APIService.showNotification(
                    `검색 완료: ${filteredData.length}건 발견`, 
                    'info'
                );
            }
        }

        // 이벤트 리스너 추가
        searchButton.addEventListener('click', performSearch);
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

        // 입력값이 비어있을 때 전체 목록 표시
        searchInput.addEventListener('input', function() {
            if (this.value.trim() === '') {
                filteredData = [...billData];
                currentPage = 1;
                renderBillTable(currentPage);
            }
        });

        console.log('✅ 검색 기능 설정 완료');
    }

    // 필터 기능 설정
    function setupFilters() {
        const filterButtons = document.querySelectorAll('.filter-btn');
        console.log(`🔧 필터 버튼 발견: ${filterButtons.length}개`);
        
        filterButtons.forEach((button, index) => {
            console.log(`🔧 필터 버튼 설정 ${index}: ${button.textContent}`);
            
            button.addEventListener('click', function() {
                console.log(`🔧 필터 클릭: ${this.getAttribute('data-filter')}`);
                
                // 활성 버튼 변경
                filterButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');

                const filterType = this.getAttribute('data-filter');
                applyFilter(filterType);
            });
        });
    }

    // 필터 적용
    function applyFilter(filterType) {
        console.log(`🔧 필터 적용: ${filterType}`);
        
        switch(filterType) {
            case 'all':
                filteredData = [...billData];
                break;
            case 'passed':
                filteredData = billData.filter(bill => bill.status === '가결');
                break;
            case 'rejected':
                filteredData = billData.filter(bill => bill.status === '부결');
                break;
            case 'pending':
                filteredData = billData.filter(bill => bill.status === '심의중');
                break;
            default:
                filteredData = [...billData];
        }

        console.log(`🔧 필터 적용 완료, 결과: ${filteredData.length}건`);
        
        if (window.APIService && window.APIService.showNotification) {
            window.APIService.showNotification(
                `${filterType} 필터 적용 (${filteredData.length}건)`, 
                'info'
            );
        }
        
        currentPage = 1;
        renderBillTable(currentPage);
    }

    // 데이터 새로고침 함수 (전역)
    window.refreshMeetingData = function() {
        console.log('🔄 본회의 데이터 새로고침');
        window.loadBillData();
    };

    // 특정 타입 데이터 로드 (전역)
    window.loadSpecificMeetingData = function(type) {
        console.log(`🔄 ${type} 본회의 데이터 로드`);
        loadSpecificLegislation(type);
    };

    // 전역으로 노출할 함수들
    window.loadSpecificLegislation = loadSpecificLegislation;

    // 페이지 초기화
    async function init() {
        console.log('📋 본회의 페이지 초기화 중...');
        
        // 요소 존재 확인
        const tableBody = document.getElementById('billTableBody');
        const totalCount = document.getElementById('totalBillCount');
        const searchInput = document.getElementById('searchInput');
        const filterButtons = document.querySelectorAll('.filter-btn');
        
        console.log('📋 요소 확인:');
        console.log(`- billTableBody: ${!!tableBody}`);
        console.log(`- totalBillCount: ${!!totalCount}`);
        console.log(`- searchInput: ${!!searchInput}`);
        console.log(`- filter buttons: ${filterButtons.length}`);
        
        try {
            // 검색 기능 설정
            setupSearch();
            
            // 필터 기능 설정
            setupFilters();
            
            // API에서 데이터 로드
            await window.loadBillData();
            
            console.log('✅ 본회의 페이지 초기화 완료!');
            
        } catch (error) {
            console.error('❌ 페이지 초기화 중 오류:', error);
            showError('페이지 초기화 중 오류 발생');
            
            // 오류 시 기본 데이터 사용
            billData = getDefaultBillData();
            filteredData = [...billData];
            renderBillTable(currentPage);
        }
    }

    // 디버그 유틸리티 (전역) - 페이지네이션 디버그 추가
    window.meetingDebug = {
        getData: () => billData,
        getFiltered: () => filteredData,
        reloadData: window.loadBillData,
        getCurrentPage: () => currentPage,
        loadSpecific: (type) => loadSpecificLegislation(type),
        
        // 페이지네이션 디버그 함수들 추가
        testPagination: () => {
            console.log('🧪 페이지네이션 테스트 시작...');
            console.log(`📊 현재 상태:`, {
                currentPage,
                totalData: billData.length,
                filteredData: filteredData.length,
                itemsPerPage: ITEMS_PER_PAGE,
                totalPages: Math.ceil(filteredData.length / ITEMS_PER_PAGE)
            });
            
            // DOM 요소 확인
            const pagination = document.getElementById('pagination');
            const tableBody = document.getElementById('billTableBody');
            
            console.log('📋 DOM 요소:', {
                pagination: !!pagination,
                tableBody: !!tableBody,
                paginationDisplay: pagination?.style.display,
                paginationHTML: pagination?.innerHTML.substring(0, 100)
            });
            
            // 페이지네이션 강제 재생성
            updatePagination();
        },
        
        changePage: (page) => {
            console.log(`🧪 테스트 페이지 변경: ${page}`);
            window.changePage(page);
        },
        
        generateTestData: (count = 50) => {
            console.log(`🧪 테스트 데이터 생성: ${count}건`);
            const testData = [];
            for (let i = 1; i <= count; i++) {
                testData.push({
                    id: `TEST_${i}`,
                    billNumber: `제22대-2024-${String(i).padStart(6, '0')}`,
                    title: `테스트 법안 ${i}번`,
                    proposer: `테스트의원${i} 의원 외 ${Math.floor(Math.random() * 10) + 5}인`,
                    date: `2024-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
                    status: ['가결', '부결', '심의중'][Math.floor(Math.random() * 3)],
                    committee: '테스트위원회',
                    age: '22'
                });
            }
            
            billData = testData;
            filteredData = [...testData];
            currentPage = 1;
            renderBillTable(1);
            
            console.log(`✅ 테스트 데이터 적용 완료: ${count}건`);
        },
        
        testAllAPIs: async () => {
            console.log('🧪 모든 본회의 API 테스트...');
            const results = {};
            
            const types = ['all', 'bill', 'costly', 'cost', 'etc', 'law'];
            for (const type of types) {
                try {
                    console.log(`📋 ${type} 테스트 중...`);
                    if (type === 'all') {
                        results[type] = await window.APIService.getAllLegislation();
                    } else {
                        await loadSpecificLegislation(type);
                        results[type] = billData;
                    }
                    console.log(`✅ ${type}: ${results[type]?.length || 0}건`);
                } catch (error) {
                    console.error(`❌ ${type} 실패:`, error);
                    results[type] = null;
                }
            }
            
            console.log('🎉 본회의 API 테스트 완료:', results);
            return results;
        },
        
        testDataMapping: () => {
            console.log('🔍 데이터 매핑 테스트:');
            const sampleData = [
                {
                    BILL_ID: 'TEST_001',
                    BILL_NM: '테스트 법안',
                    PROPOSER: '테스트 의원',
                    RGS_PROC_DT: '20240315',
                    PROC_RESULT_CD: '원안가결',
                    DETAIL_LINK: 'http://test.com',
                    age: '22'
                }
            ];
            
            const transformed = transformBillData(sampleData);
            console.log('원본 데이터:', sampleData);
            console.log('변환된 데이터:', transformed);
            return transformed;
        },
        
        showInfo: () => {
            console.log('📊 본회의 페이지 정보:');
            console.log(`- 전체 데이터: ${billData.length}건`);
            console.log(`- 필터된 데이터: ${filteredData.length}건`);
            console.log(`- 현재 페이지: ${currentPage}`);
            console.log(`- 페이지당 항목: ${ITEMS_PER_PAGE}개`);
            console.log(`- 총 페이지: ${Math.ceil(filteredData.length / ITEMS_PER_PAGE)}페이지`);
            console.log(`- API 서비스: ${!!window.APIService}`);
            console.log('- 사용 가능한 API:');
            console.log('  * getAllLegislation() - 전체 입법 데이터');
            console.log('  * getBillLegislation() - 법안 데이터');
            console.log('  * getCostlyLegislation() - 예산안 입법');
            console.log('  * getCostLegislation() - 결산안 입법');
            console.log('  * getEtcLegislation() - 기타 입법');
            console.log('  * getLawLegislation() - 법률 입법');
            console.log('- 데이터 매핑:');
            console.log('  * BILL_NM → title (법안명)');
            console.log('  * PROPOSER → proposer (제안자)');
            console.log('  * RGS_PROC_DT → date (의결일)');
            console.log('  * PROC_RESULT_CD/PRO_RESULT_CD → status (결과)');
            console.log('  * DETAIL_LINK → link (상세링크)');
            console.log('  * age → age (대수)');
            console.log('- 페이지네이션 디버그:');
            console.log('  * meetingDebug.testPagination() - 페이지네이션 테스트');
            console.log('  * meetingDebug.changePage(번호) - 페이지 변경 테스트');
            console.log('  * meetingDebug.generateTestData(수량) - 테스트 데이터 생성');
        }
    };

    // 초기화 실행
    init();
    
    console.log('✅ 본회의 페이지 스크립트 로드 완료 (업데이트된 API 연결)');
    console.log('🔧 디버그: window.meetingDebug.showInfo()');
    console.log('🧪 테스트: window.meetingDebug.testAllAPIs()');
});
