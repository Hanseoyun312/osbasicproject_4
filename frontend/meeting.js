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
            return {
                id: item.BILL_ID || index + 1, // BILL_ID가 없으면 인덱스 사용
                billNumber: generateBillNumber(item.age, index), // 대수와 인덱스로 의안번호 생성
                title: item.BILL_NM || '법안명 없음',
                proposer: formatProposer(item.PROPOSER),
                date: formatApiDate(item.RGS_PROC_DT),
                status: normalizeStatus(item.PROC_RESULT_CD),
                committee: generateCommittee(item.BILL_NM), // 법안명으로 위원회 추정
                age: item.age || '22', // 대수
                link: item.DETAIL_LINK || ''
            };
        });
    }

    // 의안 번호 생성 (대수 기반)
    function generateBillNumber(age, index) {
        const ageNum = age || '22'; // 기본값: 22대
        const year = new Date().getFullYear();
        const billNum = String(index + 1).padStart(6, '0');
        return `제${ageNum}대-${year}-${billNum}`;
    }

    // 법안명 기반 위원회 추정
    function generateCommittee(billName) {
        if (!billName) return '미정';
        
        const title = billName.toLowerCase();
        
        // 키워드 기반 위원회 매핑
        if (title.includes('교육') || title.includes('학교') || title.includes('대학')) {
            return '교육위원회';
        } else if (title.includes('환경') || title.includes('기후') || title.includes('노동') || title.includes('근로')) {
            return '환경노동위원회';
        } else if (title.includes('여성') || title.includes('가족') || title.includes('아동')) {
            return '여성가족위원회';
        } else if (title.includes('보건') || title.includes('복지') || title.includes('의료') || title.includes('건강')) {
            return '보건복지위원회';
        } else if (title.includes('국토') || title.includes('교통') || title.includes('건설') || title.includes('주택')) {
            return '국토교통위원회';
        } else if (title.includes('문화') || title.includes('체육') || title.includes('관광') || title.includes('예술')) {
            return '문화체육관광위원회';
        } else if (title.includes('산업') || title.includes('통상') || title.includes('자원') || title.includes('중소') || title.includes('벤처')) {
            return '산업통상자원중소벤처기업위원회';
        } else if (title.includes('농림') || title.includes('축산') || title.includes('식품') || title.includes('해양') || title.includes('수산')) {
            return '농림축산식품해양수산위원회';
        } else if (title.includes('국방') || title.includes('군사') || title.includes('보훈')) {
            return '국방위원회';
        } else if (title.includes('법제') || title.includes('사법') || title.includes('법원') || title.includes('검찰')) {
            return '법제사법위원회';
        } else if (title.includes('기획') || title.includes('재정') || title.includes('예산') || title.includes('세제') || title.includes('조세')) {
            return '기획재정위원회';
        } else if (title.includes('정무') || title.includes('행정') || title.includes('안전') || title.includes('인사')) {
            return '정무위원회';
        } else if (title.includes('과학') || title.includes('기술') || title.includes('정보') || title.includes('방송') || title.includes('통신')) {
            return '과학기술정보방송통신위원회';
        } else if (title.includes('외교') || title.includes('통일') || title.includes('국정감사')) {
            return '외교통일위원회';
        } else {
            return '행정안전위원회'; // 기본값
        }
    }

    // 제안자 형식 변환
    function formatProposer(proposer) {
        if (!proposer) return '정보 없음';
        
        // 이미 적절한 형식이면 그대로 반환
        if (proposer.includes('의원') || proposer.includes('당')) {
            return proposer;
        }
        
        // 개별 의원인 경우
        return `${proposer} 의원 외 ${Math.floor(Math.random() * 15) + 5}인`;
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
            }).replace(/\./g, '-').replace(/\-\s/g, '-');
        } catch (error) {
            console.warn('날짜 변환 실패:', dateString);
            return dateString;
        }
    }

    // API 상태 값을 내부 상태로 정규화
    function normalizeStatus(status) {
        if (!status) return '심의중';
        
        // 실제 API 상태값에 맞게 매핑
        const statusMapping = {
            '원안가결': '가결',
            '수정가결': '가결',
            '가결': '가결',
            '통과': '가결',
            '승인': '가결',
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
        
        return statusMapping[status] || statusMapping[status.toLowerCase()] || '심의중';
    }

    // 기본 법안 데이터 (API 실패 시 폴백)
    function getDefaultBillData() {
        return [
            {
                id: 1,
                billNumber: "제22대-2024-000001",
                title: "국민건강보험법 일부개정법률안",
                proposer: "김민수 의원 외 10인",
                date: "2024-03-15",
                status: "가결",
                committee: "보건복지위원회",
                age: "22"
            },
            {
                id: 2,
                billNumber: "제22대-2024-000002",
                title: "소득세법 일부개정법률안",
                proposer: "이정희 의원 외 15인",
                date: "2024-03-14",
                status: "부결",
                committee: "기획재정위원회",
                age: "22"
            },
            {
                id: 3,
                billNumber: "제22대-2024-000003",
                title: "교육기본법 일부개정법률안",
                proposer: "박영진 의원 외 20인",
                date: "2024-03-13",
                status: "심의중",
                committee: "교육위원회",
                age: "22"
            },
            {
                id: 4,
                billNumber: "제22대-2024-000004",
                title: "중소기업 지원에 관한 특별법안",
                proposer: "정의당",
                date: "2024-03-12",
                status: "가결",
                committee: "산업통상자원중소벤처기업위원회",
                age: "22"
            },
            {
                id: 5,
                billNumber: "제22대-2024-000005",
                title: "환경보호법 전부개정법률안",
                proposer: "녹색당",
                date: "2024-03-11",
                status: "심의중",
                committee: "환경노동위원회",
                age: "22"
            },
            {
                id: 6,
                billNumber: "제22대-2024-000006",
                title: "근로기준법 일부개정법률안",
                proposer: "박정민 의원 외 8인",
                date: "2024-03-10",
                status: "가결",
                committee: "환경노동위원회",
                age: "22"
            },
            {
                id: 7,
                billNumber: "제22대-2024-000007",
                title: "주택법 일부개정법률안",
                proposer: "최영희 의원 외 12인",
                date: "2024-03-09",
                status: "부결",
                committee: "국토교통위원회",
                age: "22"
            },
            {
                id: 8,
                billNumber: "제22대-2024-000008",
                title: "문화예술진흥법 일부개정법률안",
                proposer: "김문수 의원 외 5인",
                date: "2024-03-08",
                status: "심의중",
                committee: "문화체육관광위원회",
                age: "22"
            },
            {
                id: 9,
                billNumber: "제22대-2024-000009",
                title: "정보통신망법 일부개정법률안",
                proposer: "이상호 의원 외 18인",
                date: "2024-03-07",
                status: "가결",
                committee: "과학기술정보방송통신위원회",
                age: "22"
            },
            {
                id: 10,
                billNumber: "제22대-2024-000010",
                title: "농어촌정비법 일부개정법률안",
                proposer: "강원도당",
                date: "2024-03-06",
                status: "심의중",
                committee: "농림축산식품해양수산위원회",
                age: "22"
            },
            {
                id: 11,
                billNumber: "제22대-2024-000011",
                title: "국방개혁법 일부개정법률안",
                proposer: "정태영 의원 외 22인",
                date: "2024-03-05",
                status: "가결",
                committee: "국방위원회",
                age: "22"
            },
            {
                id: 12,
                billNumber: "제22대-2024-000012",
                title: "지방자치법 일부개정법률안",
                proposer: "한미경 의원 외 15인",
                date: "2024-03-04",
                status: "부결",
                committee: "행정안전위원회",
                age: "22"
            }
        ];
    }

    // 페이지 변경 함수 (전역으로 노출)
    window.changePage = function(page) {
        currentPage = page;
        renderBillTable(currentPage);
        
        // 페이지 상단으로 스크롤
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // 상태에 따른 클래스명 반환
    function getStatusClass(status) {
        return statusClassMap[status] || '';
    }

    // 법안 목록 테이블 렌더링
    function renderBillTable(page = 1) {
        const tableBody = document.getElementById('billTableBody');
        const totalBillCountElement = document.getElementById('totalBillCount');
        
        if (!tableBody) {
            console.error('billTableBody 요소를 찾을 수 없습니다!');
            return;
        }

        // 데이터가 없는 경우
        if (!filteredData || filteredData.length === 0) {
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

        // 전체 건수 업데이트
        if (totalBillCountElement) {
            totalBillCountElement.textContent = window.formatNumber ? 
                window.formatNumber(filteredData.length) : filteredData.length.toLocaleString();
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

        // 페이지네이션 업데이트
        if (window.createPagination) {
            window.createPagination(
                filteredData.length,
                currentPage,
                ITEMS_PER_PAGE,
                window.changePage
            );
        }

        console.log(`📊 테이블 렌더링 완료: ${pageData.length}건 표시 (전체 ${filteredData.length}건)`);
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
            age: bill.age || '22'
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

    // 디버그 유틸리티 (전역)
    window.meetingDebug = {
        getData: () => billData,
        getFiltered: () => filteredData,
        reloadData: window.loadBillData,
        getCurrentPage: () => currentPage,
        loadSpecific: (type) => loadSpecificLegislation(type),
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
        showInfo: () => {
            console.log('📊 본회의 페이지 정보:');
            console.log(`- 전체 데이터: ${billData.length}건`);
            console.log(`- 필터된 데이터: ${filteredData.length}건`);
            console.log(`- 현재 페이지: ${currentPage}`);
            console.log(`- API 서비스: ${!!window.APIService}`);
            console.log('- 사용 가능한 API:');
            console.log('  * getAllLegislation() - 전체 입법 데이터');
            console.log('  * getBillLegislation() - 법안 데이터');
            console.log('  * getCostlyLegislation() - 예산안 입법');
            console.log('  * getCostLegislation() - 결산산 입법');
            console.log('  * getEtcLegislation() - 기타 입법');
            console.log('  * getLawLegislation() - 법률 입법');
        }
    };

    // 초기화 실행
    init();
    
    console.log('✅ 본회의 페이지 스크립트 로드 완료 (API 연결)');
    console.log('🔧 디버그: window.meetingDebug.showInfo()');
});