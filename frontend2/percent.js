// 가중치 계산 및 UI 업데이트
function updateTotal() {
    const inputs = document.querySelectorAll('.weight-input');
    let total = 0;
    
    inputs.forEach(input => {
        total += parseFloat(input.value) || 0;
    });
    
    const totalValue = document.getElementById('totalValue');
    const totalStatus = document.getElementById('totalStatus');
    const totalDisplay = document.getElementById('totalDisplay');
    
    totalValue.textContent = total.toFixed(1);
    
    if (Math.abs(total - 100) < 0.1) {
        totalDisplay.className = 'total-display valid';
        totalStatus.textContent = '✅ 100% 달성!';
    } else {
        totalDisplay.className = 'total-display invalid';
        totalStatus.textContent = `⚠️ ${total > 100 ? '초과' : '부족'} (${(100 - total).toFixed(1)}% ${total > 100 ? '감소' : '추가'} 필요)`;
    }
}

// 로그 추가 함수
function addLog(message, type = 'info') {
    const statusLog = document.getElementById('statusLog');
    const timestamp = new Date().toLocaleTimeString();
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '📡';
    
    statusLog.textContent += `\n[${timestamp}] ${icon} ${message}`;
    statusLog.scrollTop = statusLog.scrollHeight;
}

// 🎯 무한루프 방지를 위한 전역 상태 관리
let isProcessing = false;
let lastProcessedTimestamp = null;
const PROCESSING_TIMEOUT = 10000; // 10초 타임아웃

// 🔧 유니크 ID 생성 함수
function generateUniqueId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 실제 정당 이름을 사용한 모의 정당 데이터 생성
function generateMockPartyData() {
    const realParties = [
        { name: '더불어민주당', members: 170 },
        { name: '국민의힘', members: 110 },
        { name: '조국혁신당', members: 12 },
        { name: '개혁신당', members: 3 },
        { name: '진보당', members: 3 },
        { name: '기본소득당', members: 1 },
        { name: '사회민주당', members: 1 },
        { name: '무소속', members: 0 }
    ];
    
    return realParties.map((party, index) => ({
        rank: index + 1,
        name: party.name,
        calculated_score: Math.round((92 - index * 3.2) * 10) / 10,
        original_score: Math.round((85 - index * 2.8) * 10) / 10,
        score_changed: true,
        weight_applied: true,
        member_count: party.members
    }));
}

// 실제 의원 이름을 사용한 모의 데이터 생성
function generateMockMemberData() {
    const realMembers = [
        { name: '어기구', party: '더불어민주당' },
        { name: '이건태', party: '더불어민주당' },
        { name: '박성준', party: '더불어민주당' },
        { name: '강병원', party: '더불어민주당' },
        { name: '김승원', party: '더불어민주당' },
        { name: '나경원', party: '국민의힘' },
        { name: '정점식', party: '국민의힘' },
        { name: '홍준표', party: '국민의힘' },
        { name: '김기현', party: '국민의힘' },
        { name: '권영세', party: '국민의힘' },
        { name: '조국', party: '조국혁신당' },
        { name: '김종민', party: '조국혁신당' },
        { name: '천하람', party: '개혁신당' },
        { name: '허은아', party: '개혁신당' },
        { name: '강은미', party: '진보당' },
        { name: '윤종오', party: '진보당' },
        { name: '용혜인', party: '기본소득당' },
        { name: '장경태', party: '더불어민주당' },
        { name: '정청래', party: '더불어민주당' },
        { name: '박지원', party: '더불어민주당' },
        { name: '이낙연', party: '더불어민주당' },
        { name: '송영길', party: '더불어민주당' },
        { name: '주호영', party: '국민의힘' },
        { name: '윤한홍', party: '국민의힘' },
        { name: '정진석', party: '국민의힘' },
        { name: '이언주', party: '개혁신당' },
        { name: '김웅', party: '개혁신당' },
        { name: '배현진', party: '국민의힘' },
        { name: '김태년', party: '더불어민주당' },
        { name: '박홍근', party: '더불어민주당' }
    ];
    
    const members = [];
    
    for (let i = 0; i < Math.min(30, realMembers.length); i++) {
        const member = realMembers[i];
        members.push({
            rank: i + 1,
            name: member.name,
            party: member.party,
            calculated_score: Math.round((95 - i * 0.8) * 10) / 10,
            original_score: Math.round((88 - i * 0.6) * 10) / 10,
            score_changed: true,
            weight_applied: true,
            calculation_timestamp: new Date().toISOString()
        });
    }
    
    return members;
}

// 🎯 가중치 적용 및 동기화 (무한루프 방지 개선)
async function applyWeightsAndSync() {
    // 🔧 중복 처리 방지
    if (isProcessing) {
        addLog('이미 처리 중입니다. 잠시 후 다시 시도해주세요.', 'warning');
        return;
    }
    
    const inputs = document.querySelectorAll('.weight-input');
    let total = 0;
    const weights = {};
    
    inputs.forEach(input => {
        const value = parseFloat(input.value) || 0;
        weights[input.dataset.weight] = value;
        total += value;
    });
    
    if (Math.abs(total - 100) > 0.1) {
        addLog(`가중치 총합이 100%가 아닙니다 (현재: ${total.toFixed(1)}%)`, 'error');
        return;
    }
    
    // 🔧 처리 상태 설정
    isProcessing = true;
    const processingTimeout = setTimeout(() => {
        isProcessing = false;
        addLog('처리 타임아웃 - 상태 리셋', 'warning');
    }, PROCESSING_TIMEOUT);
    
    try {
        addLog('가중치 적용 및 동기화 시작...', 'info');
        
        // GlobalSyncManager를 통해 실제 API 데이터로 가중치 적용
        const syncManager = window.getGlobalSyncManager();
        
        if (!syncManager) {
            addLog('GlobalSyncManager가 초기화되지 않았습니다', 'error');
            throw new Error('GlobalSyncManager 없음');
        }

        if (!syncManager.isInitialized) {
            addLog('API 데이터를 로딩 중입니다. 잠시 후 다시 시도해주세요', 'warning');
            throw new Error('GlobalSyncManager 초기화 안됨');
        }

        addLog('API 데이터를 사용하여 가중치 적용 중...', 'info');
        addLog(`🔧 DEBUG: 가중치 = ${JSON.stringify(weights)}`, 'info');
        
        // 🔧 DEBUG: GlobalSyncManager 상태 확인
        const currentData = syncManager.getCurrentData();
        addLog(`🔧 DEBUG: 원본 정당 ${currentData?.original?.parties?.length || 0}개`, 'info');
        addLog(`🔧 DEBUG: 원본 의원 ${currentData?.original?.members?.length || 0}명`, 'info');
        
        // 실제 가중치 적용
        addLog('🔧 DEBUG: syncManager.updateWeights 호출 중...', 'info');
        await syncManager.updateWeights(weights);
        addLog('🔧 DEBUG: syncManager.updateWeights 완료', 'success');
        
        // 🔧 DEBUG: 계산 결과 확인
        const updatedData = syncManager.getCurrentData();
        addLog(`🔧 DEBUG: 계산된 정당 ${updatedData?.calculated?.parties?.length || 0}개`, 'info');
        addLog(`🔧 DEBUG: 계산된 의원 ${updatedData?.calculated?.members?.length || 0}명`, 'info');
        
        if (updatedData?.calculated?.parties?.length > 0) {
            const topParty = updatedData.calculated.parties[0];
            addLog(`🔧 DEBUG: 1위 정당 = ${topParty.name} (${topParty.calculated_score}점)`, 'info');
        }
        
        addLog(`✨ 동기화 완료! 가중치 ${Object.keys(weights).length}개 적용`, 'success');
        addLog('🎯 실제 API 데이터에 가중치가 적용되었습니다!', 'success');
        addLog('📊 다른 탭들을 확인해보세요!', 'success');
        
    } catch (error) {
        addLog(`동기화 실패: ${error.message}`, 'error');
        addLog(`🔧 DEBUG: 오류 상세 = ${error.stack}`, 'error');
        console.error('가중치 적용 오류:', error);
        
        // 실패시 fallback으로 테스트 데이터 사용
        addLog('⚠️ Fallback: 테스트 데이터로 동기화 시도', 'warning');
        await applyWeightsWithFallback(weights);
    } finally {
        // 🔧 처리 완료 후 상태 리셋
        clearTimeout(processingTimeout);
        setTimeout(() => {
            isProcessing = false;
            addLog('처리 상태 리셋 완료', 'info');
        }, 2000); // 2초 후 상태 리셋
    }
}

// 🔧 Fallback 함수 (무한루프 방지 개선)
async function applyWeightsWithFallback(weights) {
    try {
        const uniqueId = generateUniqueId();
        const timestamp = new Date().toISOString();
        
        // 🔧 중복 처리 방지를 위한 타임스탬프 체크
        if (lastProcessedTimestamp && 
            new Date(timestamp).getTime() - new Date(lastProcessedTimestamp).getTime() < 1000) {
            addLog('너무 빠른 연속 요청 - 스킵', 'warning');
            return;
        }
        
        lastProcessedTimestamp = timestamp;
        
        const testData = {
            id: uniqueId, // 🔧 유니크 ID 추가
            type: 'calculated_data_distribution',
            source: 'percent_page', // 🔧 source 명시
            timestamp: timestamp,
            appliedWeights: weights,
            processingInfo: {
                uniqueId: uniqueId,
                processedAt: timestamp,
                method: 'fallback_weighted'
            },
            
            // 모의 정당 데이터
            partyData: {
                total: 8,
                top3: [
                    { rank: 1, name: '더불어민주당', score: 87.5, original_score: 78.1, score_changed: true, weight_applied: true },
                    { rank: 2, name: '진보당', score: 85.2, original_score: 75.8, score_changed: true, weight_applied: true },
                    { rank: 3, name: '조국혁신당', score: 82.9, original_score: 72.3, score_changed: true, weight_applied: true }
                ],
                full_list: generateMockPartyData()
            },
            
            // 모의 의원 데이터  
            memberData: {
                total: 300,
                top3: [
                    { rank: 1, name: '어기구', party: '더불어민주당', score: 94.2, original_score: 88.5, score_changed: true, weight_applied: true },
                    { rank: 2, name: '이건태', party: '더불어민주당', score: 91.8, original_score: 85.3, score_changed: true, weight_applied: true },
                    { rank: 3, name: '박성준', party: '더불어민주당', score: 89.5, original_score: 82.7, score_changed: true, weight_applied: true }
                ],
                full_list: generateMockMemberData()
            },
            
            // 메타데이터
            calculationInfo: {
                member_count: 300,
                party_count: 8,
                calculation_method: 'fallback_weighted',
                api_sources: ['fallback_api']
            }
        };
        
        addLog(`데이터 브로드캐스트 전송 중... (ID: ${uniqueId.substr(-8)})`, 'info');
        
        // 🔧 BroadcastChannel만 사용 (localStorage 이벤트 제거)
        if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel('client_weight_updates_v4');
            channel.postMessage(testData);
            
            // 🔧 채널 정리를 지연시켜서 메시지 전송 완료 보장
            setTimeout(() => {
                try {
                    channel.close();
                } catch (e) {
                    console.warn('BroadcastChannel 닫기 실패:', e);
                }
            }, 500);
            
            addLog('BroadcastChannel 전송 완료', 'success');
        } else {
            // 🔧 BroadcastChannel 미지원시에만 localStorage 사용
            addLog('BroadcastChannel 미지원 - localStorage 사용', 'warning');
            
            localStorage.setItem('calculated_data_distribution', JSON.stringify(testData));
            
            // 🔧 더 긴 지연 시간으로 중복 처리 방지
            setTimeout(() => {
                try {
                    localStorage.removeItem('calculated_data_distribution');
                } catch (e) {
                    console.warn('localStorage 정리 실패:', e);
                }
            }, 3000);
        }
        
        addLog(`Fallback 동기화 완료 (ID: ${uniqueId.substr(-8)})`, 'success');
        
    } catch (error) {
        addLog(`Fallback 동기화도 실패: ${error.message}`, 'error');
        console.error('Fallback 동기화 오류:', error);
    }
}

// 연결 상태 확인
function checkConnectionStatus() {
    addLog('연결 상태 확인 중...', 'info');
    
    // GlobalSyncManager 상태 확인
    const syncManager = window.getGlobalSyncManager();
    if (syncManager) {
        if (syncManager.isInitialized) {
            const currentData = syncManager.getCurrentData();
            addLog('✅ GlobalSyncManager 연결됨', 'success');
            addLog(`📊 로드된 정당: ${currentData.original.parties?.length || 0}개`, 'success');
            addLog(`👥 로드된 의원: ${currentData.original.members?.length || 0}명`, 'success');
            addLog(`📋 로드된 법안: ${currentData.original.billCounts?.length || 0}건`, 'success');
        } else {
            addLog('⏳ GlobalSyncManager 초기화 중...', 'warning');
        }
    } else {
        addLog('❌ GlobalSyncManager 미연결', 'error');
    }
    
    // BroadcastChannel 연결 확인
    if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('client_weight_updates_v4');
        
        const checkMessage = {
            type: 'connection_check',
            source: 'percent_page', // 🔧 source 명시
            timestamp: new Date().toISOString(),
            id: generateUniqueId() // 🔧 유니크 ID 추가
        };
        
        let responseCount = 0;
        
        const messageHandler = function(event) {
            if (event.data.type === 'connection_response') {
                responseCount++;
                addLog(`연결된 페이지 발견: ${event.data.source} (${event.data.data_mode || 'unknown'} 모드)`, 'success');
            }
        };
        
        channel.addEventListener('message', messageHandler);
        channel.postMessage(checkMessage);
        
        setTimeout(() => {
            channel.removeEventListener('message', messageHandler);
            addLog(`브로드캐스트 연결 확인 완료: ${responseCount}개 페이지 응답`, responseCount > 0 ? 'success' : 'warning');
            if (responseCount === 0) {
                addLog('다른 페이지들이 열려있는지 확인해주세요', 'warning');
            }
            
            try {
                channel.close();
            } catch (e) {
                console.warn('연결 확인 채널 닫기 실패:', e);
            }
        }, 2000);
        
    } else {
        addLog('BroadcastChannel을 지원하지 않는 브라우저입니다', 'error');
    }
}

// 브로드캐스트 테스트
function testBroadcast() {
    addLog('브로드캐스트 테스트 시작...', 'info');
    
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const channel = new BroadcastChannel('client_weight_updates_v4');
            const testMessage = {
                type: 'test_broadcast',
                source: 'percent_page', // 🔧 source 명시
                timestamp: new Date().toISOString(),
                id: generateUniqueId(), // 🔧 유니크 ID 추가
                message: '테스트 메시지입니다!'
            };
            
            channel.postMessage(testMessage);
            
            setTimeout(() => {
                try {
                    channel.close();
                } catch (e) {
                    console.warn('테스트 채널 닫기 실패:', e);
                }
            }, 100);
            
            addLog('브로드캐스트 테스트 메시지 전송 완료', 'success');
        } catch (error) {
            addLog(`브로드캐스트 테스트 실패: ${error.message}`, 'error');
        }
    } else {
        addLog('BroadcastChannel을 지원하지 않습니다', 'error');
    }
}

// 원본 데이터로 리셋
function resetToOriginal() {
    addLog('원본 데이터로 리셋 요청...', 'info');
    
    try {
        // GlobalSyncManager를 통해 원본 데이터로 리셋
        const syncManager = window.getGlobalSyncManager();
        
        if (syncManager && syncManager.isInitialized) {
            syncManager.resetToOriginalData();
            addLog('✅ API 원본 데이터로 리셋 요청 완료', 'success');
            addLog('🔄 다른 탭들이 원본 데이터로 복원됩니다', 'success');
            return;
        }
        
        // Fallback: BroadcastChannel로 리셋 요청
        addLog('⚠️ Fallback: 브로드캐스트로 리셋 요청', 'warning');
        
        const resetData = {
            type: 'data_reset_to_original',
            source: 'percent_page', // 🔧 source 명시
            timestamp: new Date().toISOString(),
            action: 'reset_to_original',
            id: generateUniqueId() // 🔧 유니크 ID 추가
        };
        
        // 🔧 BroadcastChannel만 사용
        if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel('client_weight_updates_v4');
            channel.postMessage(resetData);
            
            setTimeout(() => {
                try {
                    channel.close();
                } catch (e) {
                    console.warn('리셋 채널 닫기 실패:', e);
                }
            }, 100);
            
            addLog('브로드캐스트 리셋 요청 전송 완료', 'success');
        } else {
            // BroadcastChannel 미지원시에만 localStorage 사용
            localStorage.setItem('calculated_data_distribution', JSON.stringify(resetData));
            
            setTimeout(() => {
                try {
                    localStorage.removeItem('calculated_data_distribution');
                } catch (e) {
                    console.warn('리셋 localStorage 정리 실패:', e);
                }
            }, 500);
            
            addLog('Fallback 리셋 요청 전송 완료', 'success');
        }
        
    } catch (error) {
        addLog(`리셋 요청 실패: ${error.message}`, 'error');
        console.error('리셋 오류:', error);
    }
}

// 초기화 함수
function initializePercentSync() {
    // 가중치 입력 이벤트 리스너
    document.querySelectorAll('.weight-input').forEach(input => {
        input.addEventListener('input', updateTotal);
    });
    
    // 초기 총합 계산
    updateTotal();
    
    // 페이지 로드 완료 메시지
    addLog('🎯 가중치 동기화 테스트 도구 준비 완료!', 'success');
    addLog('💡 가중치를 조정하고 "가중치 적용 및 동기화" 버튼을 눌러보세요', 'info');
    
    // API 상태 확인
    setTimeout(() => {
        const syncManager = window.getGlobalSyncManager();
        if (syncManager) {
            if (syncManager.isInitialized) {
                addLog('✅ API 연결 완료 - 실제 데이터 사용 가능', 'success');
            } else {
                addLog('⏳ API 데이터 로딩 중...', 'info');
            }
        } else {
            addLog('⚠️ GlobalSyncManager 미연결 - Fallback 모드 사용', 'warning');
        }
    }, 1000);
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', initializePercentSync);