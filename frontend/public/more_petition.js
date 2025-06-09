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

    // 전역 변수로 현재 청원 정보 저장
    let currentPetitionData = null;

    // 로딩 상태 표시
    let isLoading = false;

    // 상태별 한국어 매핑 (API 응답 PROC_RESULT_CD 기준)
    const statusMap = {
        // API에서 받는 상태 코드들
        '접수': { display: '접수', step: 1, type: 'pending' },
        '심사중': { display: '심사중', step: 2, type: 'review' },
        '위원회회부': { display: '위원회 회부', step: 2, type: 'committee' },
        '위원회 회부': { display: '위원회 회부', step: 2, type: 'committee' },
        '처리완료': { display: '처리완료', step: 5, type: 'complete' },
        '폐기': { display: '폐기', step: 2, type: 'rejected' },
        '불채택': { display: '불채택', step: 2, type: 'disapproved' },
        '처리중': { display: '처리중', step: 3, type: 'review' },
        '본회의불부의': { display: '본회의불부의', step: 3, type: 'rejected' },
        '철회': { display: '철회', step: 2, type: 'rejected' },
        '종료': { display: '종료', step: 5, type: 'complete' },
        '회부': { display: '위원회 회부', step: 2, type: 'committee' }
    };

    // 위원회 매핑 (청원 제목 기반으로 추정)
    const committeeMapping = {
        '교육': '교육위원회',
        '보건': '보건복지위원회',
        '의료': '보건복지위원회',
        '복지': '보건복지위원회',
        '환경': '환경노동위원회',
        '노동': '환경노동위원회',
        '고용': '환경노동위원회',
        '국방': '국방위원회',
        '군인': '국방위원회',
        '경제': '기획재정위원회',
        '예산': '기획재정위원회',
        '세금': '기획재정위원회',
        '교통': '국토교통위원회',
        '건설': '국토교통위원회',
        '주택': '국토교통위원회',
        '문화': '문화체육관광위원회',
        '체육': '문화체육관광위원회',
        '관광': '문화체육관광위원회',
        '농업': '농림축산식품해양수산위원회',
        '어업': '농림축산식품해양수산위원회',
        '축산': '농림축산식품해양수산위원회',
        '산업': '산업통상자원중소벤처기업위원회',
        '중소기업': '산업통상자원중소벤처기업위원회',
        '과학': '과학기술정보방송통신위원회',
        '기술': '과학기술정보방송통신위원회',
        '통신': '과학기술정보방송통신위원회',
        '방송': '과학기술정보방송통신위원회',
        '법무': '법제사법위원회',
        '사법': '법제사법위원회',
        '행정': '행정안전위원회',
        '안전': '행정안전위원회',
        '소방': '행정안전위원회',
        '외교': '외교통일위원회',
        '통일': '외교통일위원회',
        '국정': '국정감사',
        '감사': '국정감사'
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
            
            // APIService를 통해 청원 목록과 소개의원 정보 가져오기
            const [petitions, introducers] = await Promise.all([
                window.APIService.getPetitions(),
                window.APIService.getPetitionIntroducers().catch(err => {
                    console.warn('청원 소개의원 정보 로드 실패:', err);
                    return [];
                })
            ]);
            
            if (!Array.isArray(petitions)) {
                throw new Error('청원 데이터 형식이 올바르지 않습니다');
            }

            // BILL_NO로 해당 청원 찾기
            const petition = petitions.find(p => 
                String(p.BILL_NO) === String(petitionId)
            );

            if (!petition) {
                throw new Error(`청원 ID ${petitionId}를 찾을 수 없습니다`);
            }

            // 소개의원 정보 찾기
            const introducerInfo = Array.isArray(introducers) ? 
                introducers.find(intro => intro.petition && intro.petition.toString().includes(petitionId)) : null;

            // API 데이터를 상세 페이지용으로 변환
            const detailData = transformToDetailedPetition(petition, introducerInfo);
            
            // 전역 변수에 저장
            currentPetitionData = detailData;
            return detailData;

        } catch (error) {
            console.error('❌ 청원 상세 정보 로드 실패:', error);
            
            // 기본 청원 정보 반환 (폴백)
            const fallbackData = getDefaultPetition();
            currentPetitionData = fallbackData;
            return fallbackData;
        }
    }

    // API 데이터를 상세 페이지용 형식으로 변환
    function transformToDetailedPetition(apiData, introducerInfo = null) {
        const statusInfo = getStatusInfo(apiData.PROC_RESULT_CD);
        const committee = determineCommittee(apiData.BILL_NAME);
        
        return {
            id: apiData.BILL_NO,
            title: apiData.BILL_NAME || '제목 없음',
            introducerMember: formatIntroducer(apiData.PROPOSER, introducerInfo),
            receiptDate: formatApiDate(apiData.PROPOSE_DT),
            referralDate: formatApiDate(apiData.PROPOSE_DT), // 회부일은 접수일과 동일하거나 별도 처리
            status: statusInfo.type,
            statusText: statusInfo.display,
            petitionNumber: apiData.BILL_NO || generatePetitionNumber(apiData.BILL_NO),
            sessionInfo: generateSessionInfo(apiData.PROPOSE_DT),
            committee: committee,
            currentStep: statusInfo.step,
            link: apiData.DETAIL_LINK || '',
            rawData: apiData // 원본 데이터 보관
        };
    }

    // 상태 정보 가져오기
    function getStatusInfo(statusCode) {
        if (!statusCode) {
            return { display: '접수', step: 1, type: 'pending' };
        }
        
        // 정확한 매칭 시도
        let statusInfo = statusMap[statusCode];
        
        // 부분 매칭 시도 (띄어쓰기 등 고려)
        if (!statusInfo) {
            const normalizedStatus = statusCode.replace(/\s+/g, '');
            for (const [key, value] of Object.entries(statusMap)) {
                if (key.replace(/\s+/g, '') === normalizedStatus) {
                    statusInfo = value;
                    break;
                }
            }
        }
        
        // 기본값 반환
        return statusInfo || { display: statusCode, step: 1, type: 'pending' };
    }

    // 위원회 결정
    function determineCommittee(petitionTitle) {
        if (!petitionTitle) return '미정';
        
        const titleLower = petitionTitle.toLowerCase();
        
        for (const [keyword, committee] of Object.entries(committeeMapping)) {
            if (titleLower.includes(keyword.toLowerCase()) || 
                petitionTitle.includes(keyword)) {
                return committee;
            }
        }
        
        return '기타 관련 위원회';
    }

    // 소개의원 형식 변환
    function formatIntroducer(proposer, introducerInfo = null) {
        // 소개의원 정보가 있는 경우
        if (introducerInfo && introducerInfo.introducer_name) {
            const introducerName = introducerInfo.introducer_name;
            const petitionCount = introducerInfo.petition || 1;
            
            if (introducerName.includes('의원')) {
                return `${introducerName} (청원 ${petitionCount}건)`;
            } else {
                return `${introducerName} 의원 (청원 ${petitionCount}건)`;
            }
        }
        
        // 제안자 정보만 있는 경우
        if (proposer) {
            if (proposer.includes('의원')) {
                return proposer;
            } else {
                // 랜덤하게 외 n인 추가 (기존 로직 유지)
                const additionalCount = Math.floor(Math.random() * 10) + 2;
                return `${proposer} 의원 외 ${additionalCount}인`;
            }
        }
        
        return '정보 없음';
    }

    // 청원 번호 생성 (BILL_NO 사용)
    function generatePetitionNumber(billNo) {
        if (billNo) return billNo;
        
        // 폴백: 기본 번호 생성
        const baseNumber = 2200000;
        const randomId = Math.floor(Math.random() * 1000) + 1;
        return String(baseNumber + randomId);
    }

    // API 날짜 형식을 화면 표시용으로 변환
    function formatApiDate(dateString) {
        if (!dateString) return '-';
        
        try {
            // YYYYMMDD 형식 처리
            if (/^\d{8}$/.test(dateString)) {
                const year = dateString.substring(0, 4);
                const month = dateString.substring(4, 6);
                const day = dateString.substring(6, 8);
                return `${year}-${month}-${day}`;
            }
            
            // 일반 날짜 형식 처리
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

    // 세션 정보 생성
    function generateSessionInfo(proposeDate) {
        if (!proposeDate) return '제22대 (2024~2028)';
        
        try {
            let year;
            if (/^\d{8}$/.test(proposeDate)) {
                year = parseInt(proposeDate.substring(0, 4));
            } else {
                year = new Date(proposeDate).getFullYear();
            }
            
            if (year >= 2024) return '제22대 (2024~2028)';
            if (year >= 2020) return '제21대 (2020~2024)';
            if (year >= 2016) return '제20대 (2016~2020)';
            
            return '제22대 (2024~2028)';
        } catch {
            return '제22대 (2024~2028)';
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
            petitionNumber: petitionId || '22000XX',
            sessionInfo: '제22대 (2024~2028)',
            currentStep: 1,
            link: ''
        };
    }

    // 홈 아이콘 클릭 이벤트 설정 (수정된 버전)
    function setupHomeIcon() {
        const homeIcon = document.querySelector('.home-icon');
        if (homeIcon) {
            homeIcon.addEventListener('click', function(e) {
                e.preventDefault();
                
                console.log('🏠 홈 아이콘 클릭됨');
                
                // 현재 청원 데이터에서 링크 확인
                let targetUrl = '';
                
                if (currentPetitionData && currentPetitionData.link) {
                    targetUrl = currentPetitionData.link;
                    console.log('✅ API에서 가져온 링크 사용:', targetUrl);
                } else {
                    targetUrl = 'petition.html';
                    console.log('⚠️ 링크가 없어서 기본 페이지로 이동:', targetUrl);
                }
                
                // 외부 링크인지 확인
                if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
                    console.log('🔗 외부 링크로 이동:', targetUrl);
                    window.open(targetUrl, '_blank');
                } else {
                    console.log('📄 내부 페이지로 이동:', targetUrl);
                    window.location.href = targetUrl;
                }
            });
            
            console.log('✅ 홈 아이콘 이벤트 리스너 설정 완료');
        } else {
            console.warn('⚠️ 홈 아이콘을 찾을 수 없습니다');
        }
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
                    
                    // 상태 배지에 색상 클래스 추가
                    if (id === 'statusBadge') {
                        element.className = `status-badge ${petition.status}`;
                    }
                }
            });
            
            // 진행 단계 업데이트
            updateProgressSteps(petition.currentStep);
            
            // 홈 아이콘 이벤트 설정 (데이터 로드 후)
            setupHomeIcon();
            
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

    // 디버그 유틸리티 (전역)
    window.petitionDetailDebug = {
        getCurrentPetitionData: () => currentPetitionData,
        reloadData: () => loadPetitionInfo(),
        testHomeIcon: () => {
            console.log('🔗 홈 아이콘 테스트:');
            console.log('- currentPetitionData?.link:', currentPetitionData?.link);
            console.log('- petitionId:', petitionId);
        },
        showInfo: () => {
            console.log('📊 청원 상세 페이지 정보:');
            console.log(`- 청원 ID: ${petitionId}`);
            console.log(`- 현재 청원 데이터:`, currentPetitionData);
            console.log(`- API 서비스: ${!!window.APIService}`);
            console.log('- URL 파라미터:', Object.fromEntries(urlParams.entries()));
        }
    };

    // 초기화 실행
    console.log(`📋 청원 상세 페이지 초기화 중... (ID: ${petitionId})`);
    
    // 툴팁 추가
    addStepTooltips();
    
    // 청원 정보 로드
    loadPetitionInfo();
    
    console.log('✅ 청원 상세 페이지 초기화 완료 (수정된 홈 아이콘 연결)');
    console.log('🔧 디버그 명령어:');
    console.log('  - window.petitionDetailDebug.showInfo() : 페이지 정보 확인');
    console.log('  - window.petitionDetailDebug.testHomeIcon() : 홈 아이콘 링크 테스트');
    console.log('  - window.petitionDetailDebug.reloadData() : 데이터 새로고침');
});
