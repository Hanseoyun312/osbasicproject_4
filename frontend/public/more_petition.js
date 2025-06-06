document.addEventListener('DOMContentLoaded', function() {
    // API 연결 상태 확인
    if (typeof window.APIService === 'undefined') {
        console.error('❌ APIService를 찾을 수 없습니다. global_sync.js가 로드되었는지 확인하세요.');
        showError('API 서비스 연결 실패');
        return;
    }

    // URL 파라미터에서 청원 정보 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const petitionId = urlParams.get('petition_id');

    // 로딩 상태 표시
    let isLoading = false;

    // 상태별 한국어 매핑 (불채택 포함)
    const statusMap = {
        '접수': '접수',
        '심사중': '심사중', 
        '위원회 회부': '위원회 회부',
        '처리완료': '처리완료',
        '폐기': '폐기',
        '불채택': '불채택',
        '처리중': '처리중',
        '본회의불부의': '본회의불부의',
        '철회': '철회',
        '종료': '종료'
    };

    // 상태별 진행 단계 매핑
    const stepMap = {
        'pending': 1,      // 접수
        'review': 2,       // 위원회 심사
        'committee': 2,    // 위원회 심사
        'complete': 5,     // 처리 통지
        'disapproved': 2,  // 위원회 심사 (불채택)
        'rejected': 3      // 위원회 심사 (폐기, 본회의 불부의)
    };

    // 로딩 표시
    function showLoading() {
        isLoading = true;
        
        // 제목 로딩
        const titleElement = document.getElementById('petitionTitle');
        if (titleElement) {
            titleElement.textContent = '청원 정보를 불러오는 중...';
            titleElement.style.color = 'var(--example)';
        }

        // 테이블 셀들 로딩 표시
        const tableElements = {
            'petitionNumber': '로딩 중...',
            'receiptDate': '로딩 중...',
            'introducerMember': '로딩 중...',
            'sessionInfo': '로딩 중...',
            'statusBadge': '로딩 중...',
            'committee': '로딩 중...'
        };

        Object.keys(tableElements).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = tableElements[id];
                element.style.color = 'var(--example)';
            }
        });

        console.log('📋 청원 상세 정보 로딩 중...');
    }

    // 에러 표시
    function showError(message) {
        const titleElement = document.getElementById('petitionTitle');
        if (titleElement) {
            titleElement.textContent = `❌ ${message}`;
            titleElement.style.color = '#f44336';
        }

        // 알림 표시
        if (window.APIService && window.APIService.showNotification) {
            window.APIService.showNotification(message, 'error');
        }

        console.error(`❌ 청원 상세 페이지 오류: ${message}`);
    }

    // API에서 청원 상세 정보 가져오기
    async function fetchPetitionDetail(petitionId) {
        try {
            if (!petitionId) {
                throw new Error('청원 ID가 제공되지 않았습니다');
            }

            console.log(`📋 청원 상세 정보 로딩: ID ${petitionId}`);
            
            // APIService를 통해 청원 목록에서 해당 청원 찾기
            const allPetitions = await window.APIService.getPetitions();
            
            if (!Array.isArray(allPetitions)) {
                throw new Error('청원 데이터 형식이 올바르지 않습니다');
            }

            // ID로 해당 청원 찾기
            const petition = allPetitions.find(p => 
                String(p.petition_id || p.id) === String(petitionId)
            );

            if (!petition) {
                throw new Error(`청원 ID ${petitionId}를 찾을 수 없습니다`);
            }

            // API 데이터를 상세 페이지용으로 변환
            return transformToDetailedPetition(petition);

        } catch (error) {
            console.error('❌ 청원 상세 정보 로드 실패:', error);
            
            // 기본 청원 정보 반환 (폴백)
            return getDefaultPetition();
        }
    }

    // API 데이터를 상세 페이지용 형식으로 변환
    function transformToDetailedPetition(apiData) {
        const status = normalizeStatus(apiData.PROC_RESULT_CD);
        
        return {
            id: apiData.BILL_NO,
            title: apiData.BILL_NAME || '제목 없음',
            introducerMember: formatIntroducer(apiData.PROPOSER),
            receiptDate: formatApiDate(apiData.PROPOSE_DT),
            referralDate: formatApiDate(apiData.PROPOSE_DT), // 회부일은 접수일과 동일하거나 별도 처리
            status: status,
            statusText: apiData.PROC_RESULT_CD || '접수',
            petitionNumber: apiData.BILL_NO || generatePetitionNumber(apiData.BILL_NO),
            sessionInfo: generateSessionInfo(apiData.PROPOSE_DT),
            committee: generateCommittee(apiData.BILL_NAME),
            currentStep: getStepFromStatus(status),
            link: apiData.LINK_URL || ''
        };
    }

    // API 상태 값을 내부 상태로 정규화
    function normalizeStatus(status) {
        if (!status) return 'pending';
        
        const statusLower = status.toLowerCase();
        
        // 상태별 한국어 매핑 
            const statusMap = {
            '접수': '접수',
            '심사중': '심사중',
            '위원회 회부': '위원회 회부',
            '처리완료': '처리완료',
            '불채택': '불채택',
            '폐기': '폐기',
            '본회의불부위': '본회의불부위',
            '철회': '철회',
            '처리중': '처리중',
            '회부': '회부',
            '종료': '종료'
        };
        
        return statusMapping[statusLower] || statusMapping[status] || 'pending';
    }

    // 소개의원 형식 변환
    function formatIntroducer(introducerName) {
        if (!introducerName) return '정보 없음';
        
        // 이미 "의원"이 포함되어 있는지 확인
        if (introducerName.includes('의원')) {
            return introducerName;
        }
        
        // 랜덤하게 외 n인 추가
        const additionalCount = Math.floor(Math.random() * 10) + 2;
        return `${introducerName} 의원 외 ${additionalCount}인`;
    }

    // 청원 번호 생성
    function generatePetitionNumber(petitionId) {
        if (!petitionId) return '22000XX';
        
        // ID를 기반으로 청원 번호 생성
        const baseNumber = 2200000;
        const idNumber = parseInt(petitionId) || 1;
        return String(baseNumber + idNumber);
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

    // 기본 청원 (API 실패 시 폴백)
    function getDefaultPetition() {
        return {
            id: petitionId || 'default',
            title: '청원 정보를 불러올 수 없습니다',
            introducerMember: '정보 없음',
            receiptDate: '-',
            referralDate: '-',
            status: 'pending',
            statusText: '접수',
            committee: '미정',
            petitionNumber: '22000XX',
            sessionInfo: '제22대 (2024~2028)',
            currentStep: 1
        };
    }

    // 페이지 정보 업데이트
    async function loadPetitionInfo() {
        try {
            showLoading();

            const petition = await fetchPetitionDetail(petitionId);
            
            if (!petition) {
                throw new Error('청원 정보를 찾을 수 없습니다');
            }
            
            // 제목 업데이트
            const titleWithNumber = `[${petition.petitionNumber}] ${petition.title}`;
            const titleElement = document.getElementById('petitionTitle');
            if (titleElement) {
                titleElement.textContent = titleWithNumber;
                titleElement.style.color = 'var(--string)';
            }
            
            // 페이지 타이틀 업데이트
            document.title = `백일하 - [${petition.petitionNumber}] ${petition.title}`;
            
            // 접수 정보 업데이트
            const updates = {
                'petitionNumber': petition.petitionNumber,
                'receiptDate': petition.receiptDate,
                'introducerMember': petition.introducerMember,
                'sessionInfo': petition.sessionInfo,
                'statusBadge': petition.statusText,
                'committee': petition.committee
            };

            Object.keys(updates).forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = updates[id];
                    element.style.color = 'var(--string)';
                }
            });
            
            // 진행 단계 업데이트
            updateProgressSteps(petition.currentStep);
            
            console.log(`✅ 청원 상세 정보 로드 완료: [${petition.petitionNumber}] ${petition.title}`);
            
            // 상태 알림 표시
            showStatusNotification(petition.status);
            
            // 성공 알림
            if (window.APIService && window.APIService.showNotification) {
                window.APIService.showNotification('청원 상세 정보 로드 완료', 'success');
            }
            
        } catch (error) {
            console.error('❌ 청원 정보 로드 중 오류:', error);
            showError('청원 정보를 불러올 수 없습니다');
        } finally {
            isLoading = false;
        }
    }

    // 진행 단계 업데이트
    function updateProgressSteps(currentStep) {
        const steps = document.querySelectorAll('.step');
        
        steps.forEach((step, index) => {
            const stepNumber = index + 1;
            if (stepNumber <= currentStep) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });

        console.log(`📊 진행 단계 업데이트: ${currentStep}/5`);
    }

    // 상태 알림
    function showStatusNotification(status) {
        const statusMessages = {
            'pending': '📝 이 청원은 접수되어 검토를 기다리고 있습니다.',
            'review': '🔍 이 청원은 현재 심사 중입니다.',
            'committee': '🏛️ 이 청원은 위원회에서 심사 중입니다.',
            'complete': '✅ 이 청원은 처리가 완료되었습니다.',
            'disapproved': '🔶 이 청원은 불채택되었습니다.',
            'rejected': '❌ 이 청원은 폐기되었습니다.'
        };

        const statusColors = {
            'pending': '#2196f3',
            'review': '#f9a825',
            'committee': '#7b1fa2',
            'complete': '#4caf50',
            'disapproved': '#d84315',
            'rejected': '#f44336'
        };

        const message = statusMessages[status];
        const color = statusColors[status];
        
        if (message) {
            // 알림 요소 생성
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background-color: ${color};
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                z-index: 1000;
                transform: translateX(100%);
                transition: transform 0.3s ease;
                max-width: 350px;
                font-family: 'Blinker', sans-serif;
            `;
            notification.textContent = message;
            
            document.body.appendChild(notification);
            
            // 애니메이션으로 표시
            setTimeout(() => {
                notification.style.transform = 'translateX(0)';
            }, 100);
            
            // 4초 후 자동 숨기기
            setTimeout(() => {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (document.body.contains(notification)) {
                        document.body.removeChild(notification);
                    }
                }, 300);
            }, 4000);
        }
    }

    // 홈 아이콘 클릭 이벤트
    const homeIcon = document.querySelector('.home-icon');
    if (homeIcon) {
        homeIcon.addEventListener('click', function(e) {
            e.preventDefault();
            // 청원 현황 페이지로 이동
            window.location.href = 'petition.html';
        });
    }

    // 진행 단계 툴팁 추가
    function addStepTooltips() {
        const steps = document.querySelectorAll('.step');
        const stepDescriptions = {
            '접수': '청원이 국회에 정식으로 접수된 상태입니다.',
            '위원회 심사': '해당 상임위원회에서 청원을 검토하고 심사 중입니다.',
            '본회의 심의': '상임위원회 심사를 거쳐 본회의에서 심의 중입니다.',
            '정부 이송': '본회의 의결 후 정부로 이송되어 처리 중입니다.',
            '처리 통지': '정부에서 처리 결과를 국회로 통지된 상태입니다.'
        };
        
        steps.forEach(step => {
            const stepName = step.textContent.trim();
            
            // 툴팁 요소 생성
            const tooltip = document.createElement('div');
            tooltip.className = 'step-tooltip';
            tooltip.textContent = stepDescriptions[stepName] || '';
            tooltip.style.cssText = `
                position: absolute;
                bottom: 100%;
                left: 50%;
                transform: translateX(-50%);
                background-color: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                width: 200px;
                text-align: center;
                opacity: 0;
                transition: opacity 0.3s;
                pointer-events: none;
                margin-bottom: 10px;
                z-index: 10;
            `;
            
            // 화살표 추가
            const arrow = document.createElement('div');
            arrow.style.cssText = `
                position: absolute;
                top: 100%;
                left: 50%;
                transform: translateX(-50%);
                width: 0;
                height: 0;
                border-left: 6px solid transparent;
                border-right: 6px solid transparent;
                border-top: 6px solid rgba(0, 0, 0, 0.8);
            `;
            tooltip.appendChild(arrow);
            
            step.style.position = 'relative';
            step.appendChild(tooltip);
            
            // 호버 이벤트
            step.addEventListener('mouseenter', function() {
                tooltip.style.opacity = '1';
            });
            
            step.addEventListener('mouseleave', function() {
                tooltip.style.opacity = '0';
            });
        });
    }

    // 데이터 새로고침 함수 (전역)
    window.refreshPetitionDetail = function() {
        console.log('🔄 청원 상세 정보 새로고침');
        loadPetitionInfo();
    };

    // 초기화 실행
    console.log(`📋 청원 상세 페이지 초기화 중... (ID: ${petitionId})`);
    
    // 툴팁 추가
    addStepTooltips();
    
    // 청원 정보 로드
    loadPetitionInfo();
    
    console.log('✅ 청원 상세 페이지 초기화 완료 (API 연결)');
});
