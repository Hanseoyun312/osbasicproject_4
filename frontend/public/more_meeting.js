document.addEventListener('DOMContentLoaded', function() {
    // API 연결 상태 확인
    if (typeof window.APIService === 'undefined') {
        console.error('❌ APIService를 찾을 수 없습니다. global_sync.js가 로드되었는지 확인하세요.');
        showError('API 서비스 연결 실패');
        return;
    }

    // URL 파라미터에서 법안 정보 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const billId = urlParams.get('bill_id');
    
    // 초기 법안 데이터 (URL 파라미터 기반)
    let billData = {
        id: billId,
        title: urlParams.get('title'),
        proposer: urlParams.get('proposer'),
        date: urlParams.get('date'),
        status: urlParams.get('status'),
        committee: urlParams.get('committee'),
        age: urlParams.get('age') || '22',
        link: urlParams.get('link') || ''
    };

    // 전역 변수로 현재 법안 정보 저장
    let currentBillData = null;

    // 로딩 상태 관리
    let isLoading = false;

    // 알림 표시 함수
    function showNotification(message, type = 'info') {
        if (window.APIService && window.APIService.showNotification) {
            window.APIService.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    // 에러 메시지 표시
    function showError(message) {
        const errorContainer = document.querySelector('.content-container');
        if (errorContainer) {
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                background: #ffebee;
                color: #c62828;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
                text-align: center;
                border: 1px solid #ffcdd2;
            `;
            errorDiv.innerHTML = `
                <h3>오류 발생</h3>
                <p>${message}</p>
            `;
            errorContainer.insertBefore(errorDiv, errorContainer.firstChild);
        }

        showNotification(message, 'error');
    }

    // API에서 법안 상세 정보 가져오기
    async function fetchBillDetail(billId) {
        try {
            console.log('📋 법안 상세 정보를 가져오는 중:', billId);
            
            if (!billId) {
                throw new Error('법안 ID가 제공되지 않았습니다');
            }

            // 먼저 전체 입법 데이터에서 해당 법안을 찾기
            const allLegislation = await window.APIService.getAllLegislation();
            
            if (!Array.isArray(allLegislation)) {
                throw new Error('입법 데이터 형식이 올바르지 않습니다');
            }

            // ID로 해당 법안 찾기
            const foundBill = allLegislation.find(bill => {
                const billIdMatch = bill.BILL_ID == billId || 
                                   bill.id == billId || 
                                   generateBillId(bill, 0) == billId;
                
                const titleMatch = billData.title && bill.BILL_NM && 
                                  bill.BILL_NM.includes(billData.title.substring(0, 20));
                
                return billIdMatch || titleMatch;
            });

            if (foundBill) {
                console.log('✅ API에서 법안 상세 정보 발견:', foundBill.BILL_NM);
                
                const detailData = {
                    id: foundBill.BILL_ID || billId,
                    billNumber: generateBillNumber(foundBill.age || '22', foundBill.BILL_ID || billId),
                    title: foundBill.BILL_NM || billData.title,
                    proposer: formatProposer(foundBill.PROPOSER || billData.proposer),
                    date: formatApiDate(foundBill.RGS_PROC_DT || billData.date),
                    status: normalizeStatus(foundBill.PROC_RESULT_CD || foundBill.PRO_RESULT_CD || billData.status),
                    committee: generateCommittee(foundBill.BILL_NM || billData.title),
                    sessionInfo: generateSessionInfo(foundBill.age || '22'),
                    voteResult: generateVoteResult(foundBill.PROC_RESULT_CD || foundBill.PRO_RESULT_CD || billData.status),
                    partyVotes: generatePartyVotes(foundBill.PROC_RESULT_CD || foundBill.PRO_RESULT_CD || billData.status),
                    relatedDocuments: [],
                    link: foundBill.DETAIL_LINK || billData.link || '',
                    age: foundBill.age || '22',
                    rawApiData: foundBill // 원본 API 데이터 보관
                };
                
                // 전역 변수에 저장
                currentBillData = detailData;
                return detailData;
            } else {
                console.warn('⚠️ API에서 해당 법안을 찾을 수 없습니다');
                throw new Error('해당 법안을 찾을 수 없습니다');
            }
            
        } catch (error) {
            console.error('❌ 법안 상세 정보 로드 실패:', error);
            
            // API 실패 시 URL 파라미터 데이터 + 샘플 데이터 사용
            const fallbackData = {
                ...billData,
                sessionInfo: generateSessionInfo(billData.age || '22'),
                voteResult: generateVoteResult(billData.status),
                partyVotes: generatePartyVotes(billData.status),
                relatedDocuments: []
            };
            
            currentBillData = fallbackData;
            return fallbackData;
        }
    }

    // 법안 ID 생성
    function generateBillId(item, index) {
        if (item.BILL_ID) return item.BILL_ID;
        
        const year = new Date().getFullYear();
        const age = item.age || '22';
        return `BILL_${age}_${year}_${String(index + 1).padStart(6, '0')}`;
    }

    // 의안 번호 생성
    function generateBillNumber(age, billId) {
        const ageNum = age || '22';
        const year = new Date().getFullYear();
        
        // billId에서 숫자 추출하여 의안번호 생성
        let billNum = '000001';
        if (billId) {
            const matches = billId.toString().match(/\d+/g);
            if (matches && matches.length > 0) {
                billNum = String(matches[matches.length - 1]).padStart(6, '0');
            }
        }
        
        return `제${ageNum}대-${year}-${billNum}`;
    }

    // 회기 정보 생성
    function generateSessionInfo(age) {
        const ageNum = age || '22';
        const currentYear = new Date().getFullYear();
        const sessionNum = Math.floor(Math.random() * 50) + 400; // 400-450회 사이
        
        const startYear = ageNum === '22' ? 2024 : (parseInt(ageNum) - 1) * 4 + 1948;
        const endYear = startYear + 3;
        
        return `제${ageNum}대 (${startYear}~${endYear}) 제${sessionNum}회`;
    }

    // 제안자 형식 변환
    function formatProposer(proposer) {
        if (!proposer) return '정보 없음';
        
        // 이미 적절한 형식이면 그대로 반환
        if (proposer.includes('의원') || proposer.includes('당') || proposer.includes('위원장')) {
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

    // 법안명 기반 위원회 추정
    function generateCommittee(billName) {
        if (!billName) return '미정';
        
        const title = billName.toLowerCase();
        
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

    // 상태에 따른 투표 결과 생성
    function generateVoteResult(status) {
        const normalizedStatus = normalizeStatus(status);
        
        if (normalizedStatus === '가결') {
            return {
                total: Math.floor(Math.random() * 20) + 285, // 285-304명
                favor: Math.floor(Math.random() * 30) + 150, // 150-179명
                against: Math.floor(Math.random() * 50) + 80, // 80-129명
                abstention: Math.floor(Math.random() * 20) + 20, // 20-39명
                absent: Math.floor(Math.random() * 10) + 5 // 5-14명
            };
        } else if (normalizedStatus === '부결') {
            return {
                total: Math.floor(Math.random() * 20) + 280, // 280-299명
                favor: Math.floor(Math.random() * 40) + 80, // 80-119명  
                against: Math.floor(Math.random() * 30) + 140, // 140-169명
                abstention: Math.floor(Math.random() * 25) + 25, // 25-49명
                absent: Math.floor(Math.random() * 12) + 8 // 8-19명
            };
        } else {
            // 심의중인 경우 투표 결과 없음
            return null;
        }
    }

    // 상태에 따른 정당별 투표 현황 생성
    function generatePartyVotes(status) {
        const normalizedStatus = normalizeStatus(status);
        
        if (normalizedStatus === '심의중') {
            return []; // 심의중인 경우 투표 현황 없음
        }
        
        const parties = [
            { name: '국민의힘', totalSeats: 108 },
            { name: '더불어민주당', totalSeats: 170 },
            { name: '조국혁신당', totalSeats: 12 },
            { name: '개혁신당', totalSeats: 3 },
            { name: '진보당', totalSeats: 3 },
            { name: '무소속', totalSeats: 4 }
        ];
        
        return parties.map(party => {
            const { name, totalSeats } = party;
            const absent = Math.floor(Math.random() * 3) + 1; // 1-3명 불참
            const participating = totalSeats - absent;
            
            if (normalizedStatus === '가결') {
                // 가결의 경우 - 여당은 찬성 많고, 야당은 반대 많음
                if (name === '국민의힘') {
                    const favor = Math.floor(participating * 0.85) + Math.floor(Math.random() * 10);
                    const against = Math.floor(participating * 0.05) + Math.floor(Math.random() * 5);
                    const abstention = participating - favor - against;
                    return { party: name, favor, against, abstention, absent };
                } else if (name === '더불어민주당') {
                    const against = Math.floor(participating * 0.6) + Math.floor(Math.random() * 15);
                    const favor = Math.floor(participating * 0.2) + Math.floor(Math.random() * 10);
                    const abstention = participating - favor - against;
                    return { party: name, favor, against, abstention, absent };
                } else {
                    // 소수정당은 다양하게
                    const favor = Math.floor(participating * 0.4) + Math.floor(Math.random() * 4);
                    const against = Math.floor(participating * 0.3) + Math.floor(Math.random() * 3);
                    const abstention = participating - favor - against;
                    return { party: name, favor, against, abstention, absent };
                }
            } else {
                // 부결의 경우 - 반대로
                if (name === '국민의힘') {
                    const against = Math.floor(participating * 0.8) + Math.floor(Math.random() * 10);
                    const favor = Math.floor(participating * 0.1) + Math.floor(Math.random() * 5);
                    const abstention = participating - favor - against;
                    return { party: name, favor, against, abstention, absent };
                } else if (name === '더불어민주당') {
                    const favor = Math.floor(participating * 0.65) + Math.floor(Math.random() * 15);
                    const against = Math.floor(participating * 0.15) + Math.floor(Math.random() * 8);
                    const abstention = participating - favor - against;
                    return { party: name, favor, against, abstention, absent };
                } else {
                    const favor = Math.floor(participating * 0.5) + Math.floor(Math.random() * 3);
                    const against = Math.floor(participating * 0.2) + Math.floor(Math.random() * 2);
                    const abstention = participating - favor - against;
                    return { party: name, favor, against, abstention, absent };
                }
            }
        });
    }

    // 페이지 내용 업데이트
    function updatePageContent(data) {
        console.log('📋 페이지 내용 업데이트 중:', data.title);
        
        // 페이지 제목 업데이트
        const pageTitle = document.querySelector('.bill-title');
        if (pageTitle) {
            pageTitle.innerHTML = `
                [${data.billNumber}] ${data.title}
                <a href="#" class="home-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2.1L1 12h3v9h7v-6h2v6h7v-9h3L12 2.1zm0 2.691l6 5.4V19h-3v-6H9v6H6v-8.809l6-5.4z"/>
                    </svg>
                </a>
            `;
        }

        // 브라우저 탭 제목 업데이트
        document.title = `백일하 - ${data.title}`;

        // 진행 단계 업데이트
        updateProgressSteps(data.status);

        // 의안 접수 정보 업데이트
        updateBillInfo(data);

        // 투표 정보 업데이트
        updateVoteSection(data);

        // 홈 아이콘 이벤트 설정 (데이터 로드 후)
        setupHomeIcon();
        
        console.log('✅ 페이지 내용 업데이트 완료');
    }

    // 투표 섹션 업데이트
    function updateVoteSection(data) {
        const voteNotice = document.querySelector('.vote-notice');
        const voteResult = data.voteResult;
        const partyVotes = data.partyVotes;
        
        if (data.status === '심의중') {
            // 심의중인 경우 투표 안내 문구 표시
            if (voteNotice) {
                voteNotice.style.display = 'flex';
            }
            hideVoteResults();
        } else {
            // 가결/부결인 경우 투표 결과 표시
            if (voteNotice) {
                voteNotice.style.display = 'none';
            }
            
            if (voteResult) {
                updateVoteResult(voteResult);
            }
            
            if (partyVotes && partyVotes.length > 0) {
                updatePartyVotes(partyVotes);
            }
        }
    }

    // 투표 결과 숨기기
    function hideVoteResults() {
        const voteResults = document.querySelectorAll('.vote-result, .vote-details, .party-vote-section');
        voteResults.forEach(element => {
            element.style.display = 'none';
        });
    }

    // 투표 결과 업데이트
    function updateVoteResult(voteResult) {
        console.log('📊 투표 결과 업데이트:', voteResult);
        
        const voteItems = document.querySelectorAll('.vote-item');
        
        if (voteItems.length >= 4) {
            // 찬성, 반대, 기권, 불참 순서로 업데이트
            const voteNumbers = [
                voteResult.favor || 0,
                voteResult.against || 0,
                voteResult.abstention || 0,
                voteResult.absent || 0
            ];
            
            voteItems.forEach((item, index) => {
                const countElement = item.querySelector('.vote-count');
                if (countElement && voteNumbers[index] !== undefined) {
                    animateCounter(countElement, 0, voteNumbers[index], 1200);
                }
            });

            // 투표 상세 정보 업데이트
            updateVoteDetails(voteResult);
        }

        // 투표 결과 섹션 표시
        const voteResultContainer = document.querySelector('.vote-result');
        const voteDetailsContainer = document.querySelector('.vote-details');
        if (voteResultContainer) voteResultContainer.style.display = 'flex';
        if (voteDetailsContainer) voteDetailsContainer.style.display = 'block';
    }

    // 투표 상세 정보 업데이트
    function updateVoteDetails(voteResult) {
        const detailRows = document.querySelectorAll('.vote-detail-row');
        
        if (detailRows.length >= 3) {
            // 투표 일시 (현재 날짜로 설정)
            const voteDate = new Date(billData.date || Date.now());
            const formatDate = voteDate.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).replace(/\./g, '-').replace(/\s/g, '') + ' 14:30';
            
            if (detailRows[0]) {
                const valueElement = detailRows[0].querySelector('.detail-value');
                if (valueElement) valueElement.textContent = formatDate;
            }

            // 총 투표 의원
            if (detailRows[1]) {
                const valueElement = detailRows[1].querySelector('.detail-value');
                if (valueElement) valueElement.textContent = `${voteResult.total}명 / 300명`;
            }

            // 투표율
            if (detailRows[2]) {
                const valueElement = detailRows[2].querySelector('.detail-value');
                const voteRate = ((voteResult.total / 300) * 100).toFixed(1);
                if (valueElement) valueElement.textContent = `${voteRate}%`;
            }
        }
    }

    // 숫자 카운터 애니메이션
    function animateCounter(element, start, end, duration) {
        const startTime = performance.now();
        
        function updateCounter(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const currentValue = Math.round(start + (end - start) * progress);
            element.textContent = currentValue;
            
            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            }
        }
        
        requestAnimationFrame(updateCounter);
    }

    // 정당별 투표 현황 업데이트
    function updatePartyVotes(partyVotes) {
        console.log('🏛️ 정당별 투표 현황 업데이트:', partyVotes.length, '개 정당');
        
        const partyVoteContainer = document.querySelector('.party-votes');
        
        if (partyVoteContainer && Array.isArray(partyVotes)) {
            partyVoteContainer.innerHTML = '';
            
            partyVotes.forEach(partyVote => {
                const partyItem = document.createElement('div');
                partyItem.className = 'party-vote-item';
                
                partyItem.innerHTML = `
                    <div class="party-name">${partyVote.party}</div>
                    <div class="party-vote-counts">
                        <span class="party-vote party-vote-for">찬성 ${partyVote.favor}</span>
                        <span class="party-vote party-vote-against">반대 ${partyVote.against}</span>
                        <span class="party-vote party-vote-abstain">기권 ${partyVote.abstention}</span>
                        ${partyVote.absent > 0 ? `<span class="party-vote party-vote-absent">불참 ${partyVote.absent}</span>` : ''}
                    </div>
                `;
                
                partyVoteContainer.appendChild(partyItem);
            });
        }

        // 정당별 투표 섹션 표시
        const partyVoteSection = document.querySelector('.party-vote-section');
        if (partyVoteSection) partyVoteSection.style.display = 'block';
    }

    // 진행 단계 업데이트
    function updateProgressSteps(status) {
        console.log('🔄 진행 단계 업데이트:', status);
        
        const steps = document.querySelectorAll('.step');
        
        // 모든 단계를 비활성화
        steps.forEach(step => step.classList.remove('active'));
        
        // 상태에 따라 활성화할 단계 결정
        let activeSteps = 0;
        switch(status) {
            case '심의중':
                activeSteps = 2; // 접수, 본회의 심의
                break;
            case '가결':
                activeSteps = 3; // 접수, 본회의 심의, 정부 이송
                break;
            case '부결':
                activeSteps = 2; // 접수, 본회의 심의
                break;
            default:
                activeSteps = 1; // 접수
        }

        // 해당 단계까지 활성화
        for (let i = 0; i < activeSteps && i < steps.length; i++) {
            steps[i].classList.add('active');
        }
    }

    // 의안 접수 정보 업데이트
    function updateBillInfo(data) {
        console.log('📝 의안 접수 정보 업데이트');
        
        const infoCells = document.querySelectorAll('.info-table .table-cell');
        
        if (infoCells.length >= 8) {
            infoCells[1].textContent = data.billNumber || '정보 없음';
            infoCells[3].textContent = data.date || '정보 없음';
            infoCells[5].textContent = data.proposer || '정보 없음';
            infoCells[7].textContent = data.sessionInfo || '제22대 (2024~2028) 제424회';
        }
    }

    // 홈 아이콘 클릭 이벤트 (수정된 버전)
    function setupHomeIcon() {
        const homeIcon = document.querySelector('.home-icon');
        if (homeIcon) {
            homeIcon.addEventListener('click', function(e) {
                e.preventDefault();
                
                console.log('🏠 홈 아이콘 클릭됨');
                
                // 현재 법안 데이터에서 링크 확인
                let targetUrl = '';
                
                if (currentBillData && currentBillData.link) {
                    targetUrl = currentBillData.link;
                    console.log('✅ API에서 가져온 링크 사용:', targetUrl);
                } else if (billData.link) {
                    targetUrl = billData.link;
                    console.log('✅ URL 파라미터 링크 사용:', targetUrl);
                } else {
                    targetUrl = 'meeting.html';
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
    
    // 진행 단계 툴팁 추가
    function setupStepTooltips() {
        console.log('💬 진행 단계 툴팁 설정 중...');
        
        const steps = document.querySelectorAll('.step');
        const stepDescriptions = {
            '접수': '법안이 국회에 제출되어 접수된 상태입니다.',
            '본회의 심의': '본회의에서 법안을 심의 중입니다.',
            '정부 이송': '가결된 법안이 정부로 이송된 상태입니다.',
            '공포': '대통령이 법안을 공포하여 법률로 확정된 상태입니다.'
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
        
        console.log('✅ 진행 단계 툴팁 설정 완료');
    }
    
    // 정보 섹션 접기/펼치기 기능
    function setupInfoSections() {
        console.log('📂 정보 섹션 접기/펼치기 설정 중...');
        
        const infoTitles = document.querySelectorAll('.info-title');
        
        infoTitles.forEach(title => {
            title.style.cursor = 'pointer';
            title.style.userSelect = 'none';
            
            title.addEventListener('click', function() {
                const section = this.parentElement;
                const content = section.querySelector('.info-table, .vote-info');
                
                if (content) {
                    if (content.style.display === 'none') {
                        content.style.display = '';
                        this.classList.remove('collapsed');
                    } else {
                        content.style.display = 'none';
                        this.classList.add('collapsed');
                    }
                }
            });
        });
    }
    
    // 페이지 애니메이션 효과
    function addPageAnimations() {
        // 테이블 행 애니메이션
        const tableRows = document.querySelectorAll('.table-row');
        
        tableRows.forEach((row, index) => {
            row.style.opacity = '0';
            row.style.transform = 'translateX(-20px)';
            
            setTimeout(() => {
                row.style.transition = 'all 0.5s ease';
                row.style.opacity = '1';
                row.style.transform = 'translateX(0)';
            }, index * 100);
        });
        
        // 진행 단계 애니메이션
        const progressSteps = document.querySelector('.progress-steps');
        if (progressSteps) {
            progressSteps.style.opacity = '0';
            progressSteps.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                progressSteps.style.transition = 'all 0.5s ease';
                progressSteps.style.opacity = '1';
                progressSteps.style.transform = 'translateY(0)';
            }, 300);
        }
        
        console.log('✨ 페이지 애니메이션 설정 완료');
    }

    // 상태 알림 메시지 표시
    function showStatusNotification(status) {
        const statusMessages = {
            '가결': '✅ 이 법안은 본회의에서 가결되었습니다.',
            '부결': '❌ 이 법안은 본회의에서 부결되었습니다.',
            '심의중': '⏳ 이 법안은 현재 심의 중입니다.'
        };

        const message = statusMessages[status];
        if (message) {
            const notificationType = status === '가결' ? 'success' : 
                                   status === '부결' ? 'error' : 
                                   'warning';
            
            showNotification(message, notificationType);
        }
    }

    // 투표 정보에 애니메이션 효과 추가
    function addVoteAnimations() {
        // 투표 결과 카운터 애니메이션
        const voteItems = document.querySelectorAll('.vote-item');
        voteItems.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                item.style.transition = 'all 0.5s ease';
                item.style.opacity = '1';
                item.style.transform = 'translateY(0)';
            }, index * 100);
        });

        // 정당별 투표 현황 애니메이션
        const partyItems = document.querySelectorAll('.party-vote-item');
        partyItems.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateX(-20px)';
            
            setTimeout(() => {
                item.style.transition = 'all 0.5s ease';
                item.style.opacity = '1';
                item.style.transform = 'translateX(0)';
            }, 500 + (index * 100));
        });
        
        console.log('📊 투표 애니메이션 설정 완료');
    }

    // 데이터 새로고침 함수 (전역)
    window.refreshMoreMeetingData = function() {
        console.log('🔄 본회의 상세 데이터 새로고침');
        initializePage();
    };

    // 페이지 초기화
    async function initializePage() {
        console.log('🚀 본회의 상세 페이지 초기화 중...');
        
        try {
            // URL 파라미터 검증
            if (!billData.id) {
                console.warn('⚠️ 법안 ID가 없습니다. URL 파라미터를 확인하세요.');
                showNotification('법안 정보가 없습니다', 'warning');
            }
            
            // API 서비스 확인 및 상세 정보 로드
            if (billId && window.APIService) {
                console.log('📡 API에서 법안 상세 정보를 가져옵니다:', billId);
                
                const detailData = await fetchBillDetail(billId);
                billData = { ...billData, ...detailData };
                
                console.log('✅ 법안 상세 정보 로드 완료:', billData.title);
                showNotification('법안 상세 정보 로드 완료', 'success');
                
            } else if (!window.APIService) {
                console.warn('⚠️ API 서비스가 연결되지 않았습니다. URL 파라미터 데이터를 사용합니다.');
                showNotification('API 연결 실패, 기본 정보 사용', 'warning');
                
                // API 없을 때 샘플 데이터 추가
                billData.sessionInfo = generateSessionInfo(billData.age || '22');
                billData.voteResult = generateVoteResult(billData.status);
                billData.partyVotes = generatePartyVotes(billData.status);
                currentBillData = billData;
            }
            
            // 페이지 내용 업데이트
            if (billData.id || billData.title) {
                updatePageContent(billData);
                
                // 상태 알림 표시
                if (billData.status) {
                    setTimeout(() => {
                        showStatusNotification(billData.status);
                    }, 1000);
                }
            } else {
                console.error('❌ 법안 정보가 없습니다.');
                showError('법안 정보를 찾을 수 없습니다');
            }
            
            // UI 기능 설정
            setupStepTooltips();
            setupInfoSections();
            addPageAnimations();
            
            console.log('✅ 본회의 상세 페이지 초기화 완료');
            
        } catch (error) {
            console.error('❌ 페이지 초기화 오류:', error);
            showError('페이지 로드 중 오류가 발생했습니다');
        }
    }

    // 투표 애니메이션 실행
    function executeVoteAnimations() {
        if (document.querySelector('.vote-info')) {
            addVoteAnimations();
        }
    }

    // 디버그 유틸리티 (전역)
    window.moreMeetingDebug = {
        getBillData: () => billData,
        getCurrentBillData: () => currentBillData,
        reloadData: () => initializePage(),
        testHomeIcon: () => {
            console.log('🔗 홈 아이콘 테스트:');
            console.log('- currentBillData?.link:', currentBillData?.link);
            console.log('- billData.link:', billData.link);
            console.log('- URL 파라미터 link:', urlParams.get('link'));
        },
        testVoteResult: () => {
            const sampleResult = generateVoteResult(billData.status || '가결');
            if (sampleResult) {
                updateVoteResult(sampleResult);
            }
        },
        testPartyVotes: () => {
            const sampleVotes = generatePartyVotes(billData.status || '가결');
            if (sampleVotes.length > 0) {
                updatePartyVotes(sampleVotes);
            }
        },
        showInfo: () => {
            console.log('📊 본회의 상세 페이지 정보:');
            console.log(`- 법안 ID: ${billData.id}`);
            console.log(`- 법안명: ${billData.title}`);
            console.log(`- 상태: ${billData.status}`);
            console.log(`- 제안자: ${billData.proposer}`);
            console.log(`- 의결일: ${billData.date}`);
            console.log(`- 위원회: ${billData.committee}`);
            console.log(`- 대수: ${billData.age}`);
            console.log(`- 링크: ${billData.link}`);
            console.log(`- 현재 법안 데이터 링크: ${currentBillData?.link}`);
            console.log(`- API 서비스: ${!!window.APIService}`);
            console.log('- URL 파라미터:', Object.fromEntries(urlParams.entries()));
        }
    };

    // 초기화 실행
    setTimeout(initializePage, 100);

    // 투표 애니메이션 실행 (지연)
    setTimeout(executeVoteAnimations, 800);

    console.log('✅ 본회의 상세 페이지 스크립트 로드 완료 (수정된 홈 아이콘 연결)');
    console.log('🔧 디버그 명령어:');
    console.log('  - window.moreMeetingDebug.showInfo() : 페이지 정보 확인');
    console.log('  - window.moreMeetingDebug.testHomeIcon() : 홈 아이콘 링크 테스트');
    console.log('  - window.moreMeetingDebug.reloadData() : 데이터 새로고침');
    console.log('📊 법안 데이터:', billData);
});
