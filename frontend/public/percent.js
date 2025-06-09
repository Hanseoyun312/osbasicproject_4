/**
 * percent.js (v5.0.0) - API 통합 가중치 계산 시스템
 * 개선사항: 3개 API 데이터를 받아서 가중치 적용 후 다른 페이지들에 완성된 데이터 전달
 */

document.addEventListener('DOMContentLoaded', function() {
    'use strict';

    // === 📊 가중치 설정 구성 (API 통합 버전) ===
    const WEIGHT_CONFIG = {
        // 기본 가중치 설정
        DEFAULT_WEIGHTS: {
            '간사': 3,
            '무효표 및 기권': 2,
            '본회의 가결': 40,
            '위원장': 5,
            '청원 소개': 8,
            '청원 결과': 23,
            '출석': 8,
            '투표 결과 일치': 7,
            '투표 결과 불일치': 4
        },

        // 🎯 API 데이터 매핑 (의원용)
        MEMBER_API_MAPPING: {
            '간사': 'committee_secretary_count',
            '무효표 및 기권': 'invalid_vote_ratio',
            '본회의 가결': 'bill_total_percent', // bill-count API의 total을 퍼센트로 변환
            '위원장': 'committee_leader_count',
            '청원 소개': 'petition_score',
            '청원 결과': 'petition_result_score',
            '출석': 'attendance_score',
            '투표 결과 일치': 'vote_match_ratio',
            '투표 결과 불일치': 'vote_mismatch_ratio'
        },

        // 🎯 API 데이터 매핑 (정당용)
        PARTY_API_MAPPING: {
            '간사': 'committee_secretary_count',
            '무효표 및 기권': 'avg_invalid_vote_ratio',
            '본회의 가결': 'bill_pass_sum',
            '위원장': 'committee_leader_count',
            '청원 소개': 'petition_sum',
            '청원 결과': 'petition_pass_sum',
            '출석': 'avg_attendance',
            '투표 결과 일치': 'avg_vote_match_ratio',
            '투표 결과 불일치': 'avg_vote_mismatch_ratio'
        },

        // 타이밍 설정
        AUTO_SAVE_DELAY: 1000,
        AUTO_APPLY_DELAY: 500,
        STORAGE_KEY: 'client_weights_v5',
        BACKUP_KEY: 'weight_backup_history_v5'
    };

    // === 🔧 애플리케이션 상태 관리 (API 통합 버전) ===
    let appState = {
        weights: {},
        isLoading: false,
        isSaving: false,
        isApplying: false,
        lastSaved: null,
        lastApplied: null,
        hasUnsavedChanges: false,
        autoSaveTimer: null,
        autoApplyTimer: null,
        
        // 🎯 API 데이터 상태
        memberApiData: [],
        billCountData: [],
        partyApiData: [],
        
        // 계산된 데이터
        calculatedMemberData: [],
        calculatedPartyData: [],
        
        // 클라이언트 전용 상태
        connectedPages: new Set(),
        realTimeUpdatesEnabled: true,
        lastCalculatedWeights: null,
        userId: generateUserId()
    };

    // DOM 요소들
    const elements = {
        checkboxItems: document.querySelectorAll('.checkbox-item'),
        percentInputs: document.querySelectorAll('.percent-input'),
        checkboxInputs: document.querySelectorAll('.checkbox-input'),
        resetButton: document.getElementById('resetButton'),
        saveStatus: document.getElementById('saveStatus'),
        lastUpdated: document.getElementById('lastUpdated'),
        exportBtn: document.getElementById('exportBtn'),
        importBtn: document.getElementById('importBtn'),
        importFile: document.getElementById('importFile')
    };

    // === 🆔 사용자별 고유 ID 생성 ===
    function generateUserId() {
        let userId = localStorage.getItem('client_user_id');
        if (!userId) {
            userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('client_user_id', userId);
        }
        return userId;
    }

    // === 🚀 초기화 함수 ===
    async function initializeApp() {
        try {
            console.log('[Percent] 🚀 API 통합 가중치 시스템 초기화... (v5.0.0)');
            console.log('[Percent] 👤 사용자 ID:', appState.userId);
            
            showLoadingState(true);
            
            // 실시간 업데이트 시스템 초기화
            initializeRealTimeSystem();
            
            // 저장된 설정 불러오기
            loadSavedSettings();
            
            // UI 초기화
            initializeUI();
            
            // 이벤트 리스너 설정
            setupEventListeners();
            
            // 자동 적용 시스템 시작
            setupAutoApply();
            
            // 랭킹 페이지 연결 확인
            checkConnectedPages();
            
            // 🎯 API 데이터 초기 로드
            await loadAllApiData();
            
            showLoadingState(false);
            
            console.log('[Percent] ✅ API 통합 가중치 시스템 초기화 완료');
            showNotification('가중치 설정이 준비되었습니다! API 데이터가 로드되었습니다.', 'success');
            
        } catch (error) {
            console.error('[Percent] ❌ 초기화 실패:', error);
            showLoadingState(false);
            showNotification('초기화에 실패했습니다: ' + error.message, 'error');
        }
    }

    // === 📡 API 데이터 로드 시스템 ===
    
    // 🎯 모든 API 데이터 로드
    async function loadAllApiData() {
        try {
            console.log('[Percent] 📡 API 데이터 로드 시작...');
            
            if (!window.APIService || !window.APIService._isReady) {
                throw new Error('API 서비스가 준비되지 않았습니다.');
            }
            
            // 3개 API 동시 호출
            const [memberResult, billCountResult, partyResult] = await Promise.allSettled([
                window.APIService.getMemberPerformance(),
                window.APIService.getMemberBillCount(),
                window.APIService.getPartyPerformance()
            ]);
            
            // 의원 실적 데이터 처리
            if (memberResult.status === 'fulfilled') {
                appState.memberApiData = processMemberApiData(memberResult.value);
                console.log(`[Percent] ✅ 의원 실적 데이터: ${appState.memberApiData.length}명`);
            } else {
                console.error('[Percent] ❌ 의원 실적 데이터 로드 실패:', memberResult.reason);
                appState.memberApiData = [];
            }
            
            // 법안 수 데이터 처리
            if (billCountResult.status === 'fulfilled') {
                appState.billCountData = processBillCountData(billCountResult.value);
                console.log(`[Percent] ✅ 법안 수 데이터: ${appState.billCountData.length}개`);
            } else {
                console.error('[Percent] ❌ 법안 수 데이터 로드 실패:', billCountResult.reason);
                appState.billCountData = [];
            }
            
            // 정당 실적 데이터 처리
            if (partyResult.status === 'fulfilled') {
                appState.partyApiData = processPartyApiData(partyResult.value);
                console.log(`[Percent] ✅ 정당 실적 데이터: ${appState.partyApiData.length}개`);
            } else {
                console.error('[Percent] ❌ 정당 실적 데이터 로드 실패:', partyResult.reason);
                appState.partyApiData = [];
            }
            
            // 데이터 병합
            mergeApiData();
            
            // 현재 가중치로 즉시 계산
            if (hasValidWeights()) {
                await calculateAndDistributeScores();
            }
            
            console.log('[Percent] ✅ API 데이터 로드 완료');
            
        } catch (error) {
            console.error('[Percent] ❌ API 데이터 로드 실패:', error);
            showNotification('API 데이터 로드에 실패했습니다: ' + error.message, 'error');
        }
    }
    
    // 🎯 의원 실적 데이터 처리
    function processMemberApiData(rawData) {
        try {
            const data = Array.isArray(rawData) ? rawData : (rawData?.ranking || []);
            
            return data
                .filter(member => member && member.lawmaker_name)
                .map(member => ({
                    id: member.lawmaker, // bill-count와 매핑용
                    name: member.lawmaker_name,
                    party: normalizePartyName(member.party),
                    total_score: parseFloat(member.total_socre || member.total_score || 0), // 원본 점수 보존
                    
                    // 가중치 계산용 세부 데이터
                    attendance_score: parseFloat(member.attendance_score || 0),
                    petition_score: parseFloat(member.petition_score || 0),
                    petition_result_score: parseFloat(member.petition_result_score || 0),
                    committee_score: parseFloat(member.committee_score || 0),
                    invalid_vote_ratio: parseFloat(member.invalid_vote_ratio || 0),
                    vote_match_ratio: parseFloat(member.vote_match_ratio || 0),
                    vote_mismatch_ratio: parseFloat(member.vote_mismatch_ratio || 0),
                    
                    // 위원장/간사 수는 committee_score에서 추출 (임시값)
                    committee_leader_count: Math.floor(parseFloat(member.committee_score || 0) / 5), // 5% = 위원장 1개
                    committee_secretary_count: Math.floor(parseFloat(member.committee_score || 0) / 3), // 3% = 간사 1개
                    
                    _originalData: member
                }));
        } catch (error) {
            console.error('[Percent] 의원 데이터 처리 실패:', error);
            return [];
        }
    }
    
    // 🎯 법안 수 데이터 처리
    function processBillCountData(rawData) {
        try {
            const data = Array.isArray(rawData) ? rawData : [];
            
            return data
                .filter(bill => bill && bill.id)
                .map(bill => ({
                    id: bill.id, // 의원 ID
                    proposer: bill.proposer,
                    total: parseInt(bill.total || 0),
                    bill_total_percent: Math.min(40, (parseInt(bill.total || 0) / 100) * 40), // 최대 40%, 100개 기준
                    _originalData: bill
                }));
        } catch (error) {
            console.error('[Percent] 법안 수 데이터 처리 실패:', error);
            return [];
        }
    }
    
    // 🎯 정당 실적 데이터 처리
    function processPartyApiData(rawData) {
        try {
            const data = Array.isArray(rawData) ? rawData : [];
            
            return data
                .filter(party => party && party.party)
                .map(party => ({
                    name: normalizePartyName(party.party),
                    avg_total_score: parseFloat(party.avg_total_score || 0), // 원본 점수 보존
                    
                    // 가중치 계산용 세부 데이터 (이미 퍼센트로 처리된 값들)
                    avg_attendance: parseFloat(party.avg_attendance || 0),
                    avg_invalid_vote_ratio: parseFloat(party.avg_invalid_vote_ratio || 0),
                    avg_vote_match_ratio: parseFloat(party.avg_vote_match_ratio || 0),
                    avg_vote_mismatch_ratio: parseFloat(party.avg_vote_mismatch_ratio || 0),
                    
                    // 수치 데이터를 퍼센트로 변환
                    bill_pass_sum: convertToPercent(party.bill_pass_sum, 'bill_pass', 'party'),
                    petition_sum: convertToPercent(party.petition_sum, 'petition', 'party'),
                    petition_pass_sum: convertToPercent(party.petition_pass_sum, 'petition_pass', 'party'),
                    committee_leader_count: convertToPercent(party.committee_leader_count, 'leader', 'party'),
                    committee_secretary_count: convertToPercent(party.committee_secretary_count, 'secretary', 'party'),
                    
                    _originalData: party
                }));
        } catch (error) {
            console.error('[Percent] 정당 데이터 처리 실패:', error);
            return [];
        }
    }
    
    // 🎯 수치를 퍼센트로 변환
    function convertToPercent(value, type, category) {
        const numValue = parseFloat(value || 0);
        
        if (category === 'party') {
            switch (type) {
                case 'bill_pass':
                    return Math.min(40, (numValue / 1000) * 40); // 1000개 기준 40%
                case 'petition':
                    return Math.min(8, (numValue / 500) * 8); // 500개 기준 8%
                case 'petition_pass':
                    return Math.min(23, (numValue / 300) * 23); // 300개 기준 23%
                case 'leader':
                    return Math.min(5, (numValue / 15) * 5); // 15개 기준 5%
                case 'secretary':
                    return Math.min(3, (numValue / 20) * 3); // 20개 기준 3%
                default:
                    return numValue;
            }
        }
        
        return numValue;
    }
    
    // 🎯 API 데이터 병합
    function mergeApiData() {
        try {
            console.log('[Percent] 📊 API 데이터 병합 중...');
            
            // 의원 데이터와 법안 수 데이터 병합
            appState.memberApiData = appState.memberApiData.map(member => {
                const billData = appState.billCountData.find(bill => bill.id === member.id);
                
                return {
                    ...member,
                    bill_total_percent: billData ? billData.bill_total_percent : 0,
                    bill_total_count: billData ? billData.total : 0
                };
            });
            
            console.log('[Percent] ✅ API 데이터 병합 완료');
            
        } catch (error) {
            console.error('[Percent] ❌ API 데이터 병합 실패:', error);
        }
    }

    // === 🧮 가중치 기반 점수 계산 시스템 ===
    
    // 🎯 현재 가중치로 점수 계산 및 배포
    async function calculateAndDistributeScores() {
        try {
            console.log('[Percent] 🧮 가중치 기반 점수 계산 시작...');
            
            const activeWeights = getCurrentActiveWeights();
            if (!activeWeights || Object.keys(activeWeights).length === 0) {
                console.log('[Percent] ⚠️ 활성 가중치가 없습니다.');
                return;
            }
            
            // 의원 점수 계산
            appState.calculatedMemberData = calculateMemberScores(activeWeights);
            
            // 정당 점수 계산
            appState.calculatedPartyData = calculatePartyScores(activeWeights);
            
            // 다른 페이지들에 계산된 데이터 전송
            await distributeCalculatedData(activeWeights);
            
            console.log('[Percent] ✅ 가중치 기반 점수 계산 완료');
            
        } catch (error) {
            console.error('[Percent] ❌ 점수 계산 실패:', error);
            throw error;
        }
    }
    
    // 🎯 의원 점수 계산
    function calculateMemberScores(weights) {
        try {
            return appState.memberApiData.map(member => {
                let totalScore = 0;
                let totalWeight = 0;
                
                // 각 가중치 항목별 점수 계산
                Object.entries(weights).forEach(([weightLabel, weightValue]) => {
                    const fieldName = WEIGHT_CONFIG.MEMBER_API_MAPPING[weightLabel];
                    const fieldValue = getMemberFieldValue(member, fieldName);
                    
                    // 가중치 적용
                    const weightedScore = (fieldValue * weightValue) / 100;
                    totalScore += weightedScore;
                    totalWeight += weightValue;
                });
                
                // 최종 점수 계산 (0-100 범위)
                const finalScore = totalWeight > 0 ? (totalScore / totalWeight) * 100 : member.total_score;
                
                return {
                    name: member.name,
                    party: member.party,
                    original_score: member.total_score,
                    calculated_score: Math.round(finalScore * 10) / 10,
                    score_changed: Math.abs(finalScore - member.total_score) > 0.1,
                    weight_applied: true,
                    calculation_timestamp: new Date().toISOString(),
                    _originalMember: member
                };
            }).sort((a, b) => b.calculated_score - a.calculated_score);
            
        } catch (error) {
            console.error('[Percent] 의원 점수 계산 실패:', error);
            return [];
        }
    }
    
    // 🎯 정당 점수 계산
    function calculatePartyScores(weights) {
        try {
            return appState.partyApiData.map(party => {
                let totalScore = 0;
                let totalWeight = 0;
                
                // 각 가중치 항목별 점수 계산
                Object.entries(weights).forEach(([weightLabel, weightValue]) => {
                    const fieldName = WEIGHT_CONFIG.PARTY_API_MAPPING[weightLabel];
                    const fieldValue = getPartyFieldValue(party, fieldName);
                    
                    // 가중치 적용
                    const weightedScore = (fieldValue * weightValue) / 100;
                    totalScore += weightedScore;
                    totalWeight += weightValue;
                });
                
                // 최종 점수 계산 (0-100 범위)
                const finalScore = totalWeight > 0 ? (totalScore / totalWeight) * 100 : party.avg_total_score;
                
                return {
                    name: party.name,
                    original_score: party.avg_total_score,
                    calculated_score: Math.round(finalScore * 10) / 10,
                    score_changed: Math.abs(finalScore - party.avg_total_score) > 0.1,
                    weight_applied: true,
                    calculation_timestamp: new Date().toISOString(),
                    _originalParty: party
                };
            }).sort((a, b) => b.calculated_score - a.calculated_score);
            
        } catch (error) {
            console.error('[Percent] 정당 점수 계산 실패:', error);
            return [];
        }
    }
    
    // 🎯 의원 필드 값 추출
    function getMemberFieldValue(member, fieldName) {
        switch (fieldName) {
            case 'attendance_score':
                return member.attendance_score || 0;
            case 'petition_score':
                return member.petition_score || 0;
            case 'petition_result_score':
                return member.petition_result_score || 0;
            case 'committee_leader_count':
                return member.committee_leader_count || 0;
            case 'committee_secretary_count':
                return member.committee_secretary_count || 0;
            case 'invalid_vote_ratio':
                return member.invalid_vote_ratio || 0;
            case 'vote_match_ratio':
                return member.vote_match_ratio || 0;
            case 'vote_mismatch_ratio':
                return member.vote_mismatch_ratio || 0;
            case 'bill_total_percent':
                return member.bill_total_percent || 0;
            default:
                return 0;
        }
    }
    
    // 🎯 정당 필드 값 추출
    function getPartyFieldValue(party, fieldName) {
        switch (fieldName) {
            case 'avg_attendance':
                return party.avg_attendance || 0;
            case 'avg_invalid_vote_ratio':
                return party.avg_invalid_vote_ratio || 0;
            case 'avg_vote_match_ratio':
                return party.avg_vote_match_ratio || 0;
            case 'avg_vote_mismatch_ratio':
                return party.avg_vote_mismatch_ratio || 0;
            case 'bill_pass_sum':
                return party.bill_pass_sum || 0;
            case 'petition_sum':
                return party.petition_sum || 0;
            case 'petition_pass_sum':
                return party.petition_pass_sum || 0;
            case 'committee_leader_count':
                return party.committee_leader_count || 0;
            case 'committee_secretary_count':
                return party.committee_secretary_count || 0;
            default:
                return 0;
        }
    }

    // === 📡 계산된 데이터 배포 시스템 ===
    
    // 🎯 계산된 데이터를 다른 페이지들에 배포
    async function distributeCalculatedData(weights) {
        try {
            console.log('[Percent] 📤 계산된 데이터 배포 시작...');
            
            // 배포할 데이터 패키지 생성
            const distributionData = {
                type: 'calculated_data_distribution',
                timestamp: new Date().toISOString(),
                source: 'percent_page',
                userId: appState.userId,
                mode: 'api_calculated',
                
                // 적용된 가중치 정보
                appliedWeights: weights,
                totalWeight: Object.values(weights).reduce((sum, w) => sum + w, 0),
                
                // 계산된 데이터
                memberData: {
                    total: appState.calculatedMemberData.length,
                    top3: appState.calculatedMemberData.slice(0, 3).map((member, index) => ({
                        rank: index + 1,
                        name: member.name,
                        party: member.party,
                        score: member.calculated_score,
                        original_score: member.original_score,
                        score_changed: member.score_changed,
                        weight_applied: true
                    })),
                    full_list: appState.calculatedMemberData
                },
                
                partyData: {
                    total: appState.calculatedPartyData.length,
                    top3: appState.calculatedPartyData.slice(0, 3).map((party, index) => ({
                        rank: index + 1,
                        name: party.name,
                        score: party.calculated_score,
                        original_score: party.original_score,
                        score_changed: party.score_changed,
                        weight_applied: true
                    })),
                    full_list: appState.calculatedPartyData
                },
                
                // 메타데이터
                calculationInfo: {
                    member_count: appState.memberApiData.length,
                    party_count: appState.partyApiData.length,
                    bill_count_data: appState.billCountData.length,
                    calculation_method: 'api_weighted',
                    api_sources: [
                        '/performance/api/performance/',
                        '/legislation/bill-count/',
                        '/performance/api/party_performance/'
                    ]
                }
            };
            
            // 1. localStorage 이벤트
            localStorage.setItem('calculated_data_distribution', JSON.stringify(distributionData));
            localStorage.setItem('last_calculation_update', Date.now().toString());
            
            // 2. BroadcastChannel (실시간 통신)
            const broadcastSuccess = safeBroadcast(distributionData);
            if (broadcastSuccess) {
                console.log('[Percent] 📡 BroadcastChannel로 계산된 데이터 배포 성공');
            } else {
                console.warn('[Percent] ⚠️ BroadcastChannel 배포 실패, localStorage만 사용');
            }
            
            // 3. 커스텀 이벤트
            document.dispatchEvent(new CustomEvent('calculatedDataDistribution', {
                detail: distributionData
            }));
            
            // 4. 상태 업데이트
            appState.lastApplied = new Date();
            appState.lastCalculatedWeights = { ...weights };
            
            console.log('[Percent] ✅ 계산된 데이터 배포 완료');
            
            // 5. UI 업데이트
            updateSaveStatus('applied', '✅ API 계산 + 배포 완료!');
            updateLastAppliedDisplay();
            
            return true;
            
        } catch (error) {
            console.error('[Percent] ❌ 계산된 데이터 배포 실패:', error);
            throw error;
        } finally {
            // localStorage 정리
            setTimeout(() => {
                try {
                    localStorage.removeItem('calculated_data_distribution');
                } catch (e) {
                    // 무시
                }
            }, 1000);
        }
    }

    // === 🎯 핵심: API 기반 가중치 적용 ===
    async function applyWeightsToRanking() {
        try {
            console.log('[Percent] 🎯 API 기반 가중치 적용 시작...');
            
            appState.isApplying = true;
            updateSaveStatus('saving', '🔄 API 데이터로 가중치 적용 중...');

            // 📊 현재 활성화된 가중치 수집
            const activeWeights = getCurrentActiveWeights();
            
            // 가중치 검증
            const totalWeight = Object.values(activeWeights).reduce((sum, w) => sum + w, 0);
            if (Math.abs(totalWeight - 100) > 0.1) {
                throw new Error(`총 가중치가 100%가 아닙니다 (현재: ${totalWeight.toFixed(1)}%)`);
            }

            // API 데이터가 없으면 로드
            if (appState.memberApiData.length === 0 || appState.partyApiData.length === 0) {
                showNotification('API 데이터를 로드하는 중...', 'info');
                await loadAllApiData();
            }

            // 가중치 기반 점수 계산 및 배포
            await calculateAndDistributeScores();

            // 상태 업데이트
            appState.lastApplied = new Date();
            appState.isApplying = false;
            
            // 성공 메시지
            updateSaveStatus('applied', '✅ API 기반 가중치 적용 완료!');
            updateLastAppliedDisplay();
            
            console.log('[Percent] ✅ API 기반 가중치 적용 완료');
            
            // 🎉 성공 알림
            showNotification(`API 데이터 기반으로 가중치가 적용되었습니다! 의원 ${appState.calculatedMemberData.length}명, 정당 ${appState.calculatedPartyData.length}개`, 'success', 5000);
            
            return true;

        } catch (error) {
            console.error('[Percent] ❌ API 기반 가중치 적용 실패:', error);
            
            appState.isApplying = false;
            updateSaveStatus('error', '❌ 적용 실패');
            showNotification(`가중치 적용 실패: ${error.message}`, 'error', 6000);
            
            return false;
        }
    }

    // === 🔧 유틸리티 함수들 ===
    
    // 현재 활성 가중치 추출
    function getCurrentActiveWeights() {
        const activeWeights = {};
        
        elements.percentInputs.forEach(input => {
            const label = input.dataset.item;
            
            if (!input.disabled) {
                const value = parseFloat(input.value.replace('%', '')) || 0;
                activeWeights[label] = value;
            }
        });
        
        return activeWeights;
    }
    
    // 유효한 가중치 확인
    function hasValidWeights() {
        const weights = getCurrentActiveWeights();
        const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
        return Math.abs(total - 100) < 0.1 && Object.keys(weights).length > 0;
    }
    
    // 정당명 정규화
    function normalizePartyName(partyName) {
        if (!partyName || typeof partyName !== 'string') return '정보없음';
        
        const nameMapping = {
            '더불어민주당': '더불어민주당',
            '민주당': '더불어민주당',
            '국민의힘': '국민의힘',
            '국민의 힘': '국민의힘',
            '조국혁신당': '조국혁신당',
            '개혁신당': '개혁신당',
            '진보당': '진보당',
            '기본소득당': '기본소득당',
            '사회민주당': '사회민주당',
            '무소속': '무소속',
            '없음': '무소속'
        };

        return nameMapping[partyName.trim()] || partyName.trim();
    }

    // === 🔗 실시간 업데이트 시스템 초기화 ===
    function initializeRealTimeSystem() {
        console.log('[Percent] 🔗 실시간 업데이트 시스템 초기화...');
        
        // BroadcastChannel 설정 (페이지간 실시간 통신)
        createBroadcastChannel();
        
        // 페이지 연결 상태 주기적 확인
        setInterval(checkConnectedPages, 10000); // 10초마다
    }

    // === 📡 BroadcastChannel 생성 및 관리 ===
    function createBroadcastChannel() {
        if (typeof BroadcastChannel === 'undefined') {
            console.warn('[Percent] ⚠️ BroadcastChannel을 지원하지 않는 브라우저입니다');
            return false;
        }

        try {
            // 기존 채널이 있으면 정리
            if (window.weightUpdateChannel) {
                try {
                    window.weightUpdateChannel.close();
                } catch (e) {
                    // 이미 닫혔을 수 있음
                }
            }

            // 새 채널 생성
            window.weightUpdateChannel = new BroadcastChannel('client_weight_updates_v4');
            
            // 다른 페이지에서 연결 확인 요청 수신
            window.weightUpdateChannel.addEventListener('message', function(event) {
                try {
                    if (event.data.type === 'connection_check') {
                        // 응답 전송 (채널 상태 확인 후)
                        safeBroadcast({
                            type: 'connection_response',
                            source: 'percent_page',
                            timestamp: new Date().toISOString(),
                            status: 'connected',
                            mode: 'api_integrated',
                            userId: appState.userId,
                            api_data_loaded: appState.memberApiData.length > 0 && appState.partyApiData.length > 0
                        });
                        
                        appState.connectedPages.add(event.data.source);
                        updateConnectedPagesDisplay();
                    }
                } catch (error) {
                    console.warn('[Percent] 메시지 처리 실패:', error);
                }
            });

            // 채널 오류 처리
            window.weightUpdateChannel.addEventListener('error', function(error) {
                console.warn('[Percent] BroadcastChannel 오류:', error);
                // 채널 재생성 시도
                setTimeout(createBroadcastChannel, 1000);
            });
            
            console.log('[Percent] ✅ BroadcastChannel 초기화 완료');
            return true;
            
        } catch (e) {
            console.warn('[Percent] ⚠️ BroadcastChannel 초기화 실패:', e);
            window.weightUpdateChannel = null;
            return false;
        }
    }

    // === 📡 안전한 브로드캐스트 함수 ===
    function safeBroadcast(data) {
        try {
            if (!window.weightUpdateChannel) {
                // 채널이 없으면 재생성 시도
                if (!createBroadcastChannel()) {
                    return false;
                }
            }

            // 채널 상태 확인 (readyState는 없지만, 예외 발생으로 확인)
            window.weightUpdateChannel.postMessage(data);
            return true;
            
        } catch (error) {
            console.warn('[Percent] 브로드캐스트 실패, 채널 재생성 시도:', error);
            
            // 채널 재생성 시도
            if (createBroadcastChannel()) {
                try {
                    window.weightUpdateChannel.postMessage(data);
                    return true;
                } catch (retryError) {
                    console.warn('[Percent] 재시도 후에도 브로드캐스트 실패:', retryError);
                }
            }
            
            return false;
        }
    }

    // === 📡 연결된 페이지 확인 (안전한 버전) ===
    function checkConnectedPages() {
        try {
            const success = safeBroadcast({
                type: 'connection_check',
                source: 'percent_page',
                timestamp: new Date().toISOString(),
                userId: appState.userId,
                api_data_status: {
                    member_count: appState.memberApiData.length,
                    party_count: appState.partyApiData.length,
                    bill_count: appState.billCountData.length
                }
            });
            
            if (!success) {
                console.warn('[Percent] 연결 확인 브로드캐스트 실패');
            }
        } catch (error) {
            console.warn('[Percent] 연결 확인 중 오류:', error);
        }
    }

    // === 🎨 연결된 페이지 표시 업데이트 ===
    function updateConnectedPagesDisplay() {
        try {
            let statusElement = document.getElementById('connected-pages-status');
            if (!statusElement) {
                statusElement = document.createElement('div');
                statusElement.id = 'connected-pages-status';
                statusElement.style.cssText = `
                    margin-top: 15px; padding: 12px 16px; 
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    border-radius: 8px; font-size: 13px; color: white;
                    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2);
                `;
                
                // 체크박스 그리드 다음에 추가
                const checkboxGrid = document.querySelector('.checkbox-grid');
                if (checkboxGrid) {
                    checkboxGrid.insertAdjacentElement('afterend', statusElement);
                }
            }
            
            const connectedCount = appState.connectedPages.size;
            const apiDataLoaded = appState.memberApiData.length > 0 && appState.partyApiData.length > 0;
            
            statusElement.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>🔗 연결된 랭킹 페이지: <strong>${connectedCount}개</strong></span>
                    <span style="color: #fbbf24;">📡 API 통합 모드</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                    <span style="font-size: 11px; opacity: 0.9;">
                        ${connectedCount > 0 ? 
                            '✓ 실시간 데이터 배포 활성화' : 
                            '⚠ 랭킹 페이지를 열어주세요'
                        }
                    </span>
                    <span style="font-size: 10px; opacity: 0.8;">
                        API: ${apiDataLoaded ? '✅ 로드됨' : '⏳ 로딩중'}
                    </span>
                </div>
                <div style="font-size: 10px; opacity: 0.8; margin-top: 4px;">
                    의원 ${appState.memberApiData.length}명 | 정당 ${appState.partyApiData.length}개 | 법안 ${appState.billCountData.length}개
                </div>
            `;
            
        } catch (error) {
            console.warn('[Percent] 연결 상태 표시 업데이트 실패:', error);
        }
    }

    // === 📋 설정 저장/불러오기 (기존 로직 유지) ===
    function loadSavedSettings() {
        try {
            console.log('[Percent] 📥 저장된 설정 불러오기...');

            const savedData = localStorage.getItem(WEIGHT_CONFIG.STORAGE_KEY);
            
            if (savedData) {
                const parsed = JSON.parse(savedData);
                console.log('[Percent] ✅ 저장된 설정 복원');
                
                Object.keys(parsed).forEach(label => {
                    if (label.startsWith('_')) return; // 메타데이터 스킵
                    
                    const data = parsed[label];
                    
                    // 체크박스 복원
                    elements.checkboxInputs.forEach(checkbox => {
                        const checkboxLabel = checkbox.closest('.checkbox-item')
                            .querySelector('.checkbox-label').textContent.trim();
                        if (checkboxLabel === label) {
                            checkbox.checked = data.enabled;
                        }
                    });
                    
                    // 입력값 복원
                    elements.percentInputs.forEach(input => {
                        if (input.dataset.item === label) {
                            input.value = data.value + '%';
                            input.disabled = !data.enabled;
                            updateInputStyle(input, data.enabled);
                        }
                    });
                });
                
                appState.lastSaved = new Date(parsed._timestamp || Date.now());
                
            } else {
                console.log('[Percent] 📋 저장된 설정 없음 - 기본값 사용');
                resetToDefaults();
            }
            
            calculateAndDisplayTotal();
            updateLastSavedDisplay();
            
        } catch (error) {
            console.error('[Percent] 설정 불러오기 실패:', error);
            resetToDefaults();
            showNotification('설정 불러오기에 실패하여 기본값을 사용합니다', 'warning');
        }
    }

    function saveSettings() {
        try {
            console.log('[Percent] 💾 설정 저장 중...');
            
            const settingsData = {};
            
            elements.percentInputs.forEach(input => {
                const label = input.dataset.item;
                const value = parseFloat(input.value.replace('%', '')) || 0;
                const isEnabled = !input.disabled;
                
                settingsData[label] = {
                    value: value,
                    enabled: isEnabled
                };
            });
            
            // 메타데이터 추가
            settingsData._timestamp = Date.now();
            settingsData._version = '5.0.0';
            settingsData._lastApplied = appState.lastApplied?.toISOString();
            settingsData._mode = 'api_integrated';
            settingsData._userId = appState.userId;
            
            localStorage.setItem(WEIGHT_CONFIG.STORAGE_KEY, JSON.stringify(settingsData));
            
            appState.lastSaved = new Date();
            appState.hasUnsavedChanges = false;
            
            updateSaveStatus('saved', '💾 자동 저장됨');
            updateLastSavedDisplay();
            
            console.log('[Percent] ✅ 설정 저장 완료');
            return true;
            
        } catch (error) {
            console.error('[Percent] 설정 저장 실패:', error);
            updateSaveStatus('error', '💥 저장 실패');
            throw error;
        }
    }

    // === 🔄 초기화 함수 (개선된 버전) ===
    function resetToDefaults() {
        if (!confirm('모든 값을 초기값으로 되돌리시겠습니까? API 데이터도 다시 로드됩니다.')) {
            return;
        }

        try {
            console.log('[Percent] 🔄 기본값으로 초기화...');

            // 1. localStorage 완전 정리
            localStorage.removeItem('calculated_data_distribution');
            localStorage.removeItem('last_calculation_update');
            localStorage.removeItem(WEIGHT_CONFIG.STORAGE_KEY);

            // 2. 앱 상태 초기화
            appState.lastApplied = null;
            appState.lastCalculatedWeights = null;
            appState.calculatedMemberData = [];
            appState.calculatedPartyData = [];

            // 3. 모든 체크박스 체크
            elements.checkboxInputs.forEach(checkbox => {
                checkbox.checked = true;
            });

            // 4. 모든 입력 필드 초기값 설정
            elements.percentInputs.forEach(input => {
                const label = input.dataset.item;
                const defaultValue = WEIGHT_CONFIG.DEFAULT_WEIGHTS[label];
                
                if (defaultValue !== undefined) {
                    input.value = defaultValue + '%';
                    input.disabled = false;
                    updateInputStyle(input, true);
                }
            });

            // 5. UI 업데이트
            calculateAndDisplayTotal();
            updateSaveStatus('reset', '🔄 초기화됨');
            updateLastSavedDisplay();

            // 6. 다른 페이지들에 초기화 알림 전송
            const resetData = {
                type: 'data_reset_to_original',
                timestamp: new Date().toISOString(),
                source: 'percent_page',
                action: 'reset_to_api_original',
                mode: 'api_integrated',
                userId: appState.userId
            };

            // localStorage 이벤트
            localStorage.setItem('calculated_data_distribution', JSON.stringify(resetData));
            
            // BroadcastChannel 알림
            const broadcastSuccess = safeBroadcast(resetData);
            if (broadcastSuccess) {
                console.log('[Percent] 📡 초기화 알림 전송 성공');
            }

            // 커스텀 이벤트
            document.dispatchEvent(new CustomEvent('dataResetToOriginal', {
                detail: resetData
            }));

            // 7. API 데이터 다시 로드
            setTimeout(() => {
                loadAllApiData();
            }, 1000);

            showNotification('기본값으로 초기화되었습니다. API 데이터를 다시 로드합니다.', 'info');
            console.log('[Percent] ✅ 기본값 초기화 완료');

            // localStorage 정리 (1초 후)
            setTimeout(() => {
                try {
                    localStorage.removeItem('calculated_data_distribution');
                } catch (e) {
                    // 무시
                }
            }, 1000);
            
        } catch (error) {
            console.error('[Percent] 기본값 초기화 실패:', error);
            showNotification('초기화에 실패했습니다', 'error');
        }
    }

    // === 🔄 자동 적용 시스템 ===
    function setupAutoApply() {
        console.log('[Percent] 🔄 자동 적용 시스템 시작...');
    }

    function scheduleAutoApply() {
        appState.hasUnsavedChanges = true;
        updateSaveStatus('saving', '💾 저장 중...');
        
        clearTimeout(appState.autoSaveTimer);
        clearTimeout(appState.autoApplyTimer);
        
        // 먼저 설정 저장
        appState.autoSaveTimer = setTimeout(() => {
            try {
                saveSettings();
                
                // 🎯 100% 도달 시 API 기반 자동 적용
                if (hasValidWeights()) {
                    // 즉시 API 기반 순위 적용
                    appState.autoApplyTimer = setTimeout(() => {
                        console.log('[Percent] 🔄 API 기반 자동 순위 적용 (100% 도달)');
                        applyWeightsToRanking();
                    }, WEIGHT_CONFIG.AUTO_APPLY_DELAY);
                }
                
            } catch (error) {
                console.error('[Percent] 자동 저장 실패:', error);
                updateSaveStatus('error', '💥 저장 실패');
            }
        }, WEIGHT_CONFIG.AUTO_SAVE_DELAY);
    }

    // === 기존 UI 관리 함수들 (모두 유지) ===
    function updatePercentField(itemName, isChecked) {
        elements.percentInputs.forEach(input => {
            if (input.dataset.item === itemName) {
                input.disabled = !isChecked;
                updateInputStyle(input, isChecked);
                
                if (!isChecked) {
                    input.value = '0%';
                }
            }
        });
        
        calculateAndDisplayTotal();
        scheduleAutoApply();
    }

    function updateInputStyle(input, isEnabled) {
        if (isEnabled) {
            input.style.opacity = '1';
            input.style.backgroundColor = '#f9f9f9';
            input.style.cursor = 'text';
        } else {
            input.style.opacity = '0.3';
            input.style.backgroundColor = '#e0e0e0';
            input.style.cursor = 'not-allowed';
        }
    }

    function calculateAndDisplayTotal() {
        let total = 0;
        let activeCount = 0;

        elements.percentInputs.forEach(input => {
            if (!input.disabled) {
                const value = parseFloat(input.value.replace('%', '')) || 0;
                total += value;
                activeCount++;
            }
        });

        // 합계 표시 UI 업데이트
        let totalDisplay = document.querySelector('.total-display');
        if (!totalDisplay) {
            totalDisplay = document.createElement('div');
            totalDisplay.className = 'total-display';
            document.querySelector('.percent-grid').after(totalDisplay);
        }
        
        const isValid = Math.abs(total - 100) < 0.1;
        totalDisplay.className = `total-display ${isValid ? 'valid' : 'invalid'}`;
        
        totalDisplay.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: ${isValid ? '#f0f9ff' : '#fef2f2'}; border: 1px solid ${isValid ? '#10b981' : '#ef4444'}; border-radius: 8px; margin-top: 15px;">
                <span style="color: #64748b;">활성 항목: <strong>${activeCount}개</strong></span>
                <span style="color: ${isValid ? '#10b981' : '#ef4444'};">총합: <strong>${total.toFixed(1)}%</strong></span>
                ${isValid ? 
                    '<span style="color: #10b981; font-weight: 600;">✓ API 기반 순위 적용 가능</span>' : 
                    '<span style="color: #ef4444; font-weight: 600;">⚠ 100%로 조정 필요</span>'
                }
            </div>
        `;
    }

    // 기타 UI 함수들
    function updateSaveStatus(status, message) {
        if (!elements.saveStatus) return;
        
        elements.saveStatus.className = `save-status ${status}`;
        elements.saveStatus.textContent = message;
    }

    function updateLastSavedDisplay() {
        if (!elements.lastUpdated) return;
        
        const savedTime = appState.lastSaved ? appState.lastSaved.toLocaleTimeString('ko-KR') : '없음';
        const appliedTime = appState.lastApplied ? appState.lastApplied.toLocaleTimeString('ko-KR') : '없음';
        
        elements.lastUpdated.innerHTML = `
            <div style="font-size: 12px; color: #64748b;">
                <div>💾 마지막 저장: ${savedTime}</div>
                <div>🎯 마지막 적용: ${appliedTime}</div>
                <div>📡 API 통합 모드</div>
                <div>👤 ID: ${appState.userId.substr(-8)}</div>
            </div>
        `;
    }

    function updateLastAppliedDisplay() {
        updateLastSavedDisplay();
    }

    function showLoadingState(isLoading) {
        document.body.style.opacity = isLoading ? '0.7' : '1';
        document.body.style.pointerEvents = isLoading ? 'none' : 'auto';
    }

    function initializeUI() {
        console.log('[Percent] 🎨 UI 초기화...');
        
        // 페이지 로드 애니메이션
        document.querySelector('.checkbox-grid')?.classList.add('fade-in');
        document.querySelector('.percent-grid')?.classList.add('fade-in');
        
        // 초기 상태 업데이트
        updateSaveStatus('saved', '💾 준비됨');
        calculateAndDisplayTotal();
        
        // 연결 상태 표시 초기화
        updateConnectedPagesDisplay();
        
        // API 통합 모드 알림 표시
        showApiIntegratedModeInfo();
    }

    // === 💻 API 통합 모드 정보 표시 ===
    function showApiIntegratedModeInfo() {
        try {
            let infoElement = document.getElementById('api-integrated-mode-info');
            if (!infoElement) {
                infoElement = document.createElement('div');
                infoElement.id = 'api-integrated-mode-info';
                infoElement.style.cssText = `
                    margin: 10px 0; padding: 12px 16px; 
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                    color: white; border-radius: 8px; font-size: 13px;
                    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
                `;
                
                // 상단에 추가
                const container = document.querySelector('.main') || document.body;
                const firstChild = container.firstChild;
                if (firstChild) {
                    container.insertBefore(infoElement, firstChild);
                } else {
                    container.appendChild(infoElement);
                }
            }
            
            infoElement.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 16px;">📡</span>
                    <div>
                        <div style="font-weight: 600;">API 통합 가중치 모드 (v5.0.0)</div>
                        <div style="font-size: 11px; opacity: 0.9; margin-top: 2px;">
                            실제 API 데이터로 점수 계산 • 3개 API 통합 • 실시간 배포
                        </div>
                    </div>
                </div>
            `;
            
        } catch (error) {
            console.warn('[Percent] API 통합 모드 정보 표시 실패:', error);
        }
    }

    // === 🎮 이벤트 리스너 설정 ===
    function setupEventListeners() {
        console.log('[Percent] 🎮 이벤트 리스너 설정...');

        // 체크박스 이벤트
        elements.checkboxInputs.forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const itemName = this.dataset.item;
                updatePercentField(itemName, this.checked);
            });
        });

        // 퍼센트 입력 필드 이벤트
        elements.percentInputs.forEach(input => {
            setupPercentInputEvents(input);
        });

        // 초기화 버튼
        if (elements.resetButton) {
            elements.resetButton.addEventListener('click', resetToDefaults);
        }

        // 백업/복원 버튼들
        if (elements.exportBtn) {
            elements.exportBtn.addEventListener('click', exportSettings);
        }
        
        if (elements.importBtn) {
            elements.importBtn.addEventListener('click', () => elements.importFile?.click());
        }
        
        if (elements.importFile) {
            elements.importFile.addEventListener('change', importSettings);
        }

        // 페이지 언로드 시 저장
        window.addEventListener('beforeunload', function(event) {
            if (appState.hasUnsavedChanges) {
                event.preventDefault();
                event.returnValue = '저장되지 않은 변경사항이 있습니다.';
            }
            
            // BroadcastChannel 정리 (안전하게)
            if (window.weightUpdateChannel) {
                try {
                    window.weightUpdateChannel.close();
                } catch (e) {
                    // 이미 닫혔을 수 있음, 무시
                }
                window.weightUpdateChannel = null;
            }
        });
    }

    // 퍼센트 입력 필드 이벤트 설정
    function setupPercentInputEvents(input) {
        // 실시간 입력 처리
        input.addEventListener('input', function(e) {
            if (this.disabled) {
                e.preventDefault();
                return;
            }

            const cursorPosition = this.selectionStart;
            const cleanedValue = cleanNumericValue(this.value);
            
            this.value = cleanedValue + '%';
            
            const newCursorPosition = Math.min(cursorPosition, this.value.length - 1);
            this.setSelectionRange(newCursorPosition, newCursorPosition);
            
            calculateAndDisplayTotal();
            scheduleAutoApply();
        });

        // 포커스 해제 시 처리
        input.addEventListener('blur', function() {
            if (this.disabled) return;
            
            let cleanedValue = cleanNumericValue(this.value);
            
            if (cleanedValue === '') {
                cleanedValue = '0';
            }
            
            this.value = cleanedValue + '%';
            
            calculateAndDisplayTotal();
            scheduleAutoApply();
        });
    }

    function cleanNumericValue(value) {
        let cleanValue = value.replace('%', '').trim();
        cleanValue = cleanValue.replace(/[^\d.-]/g, '');
        
        if (cleanValue === '' || cleanValue === '-') {
            return '0';
        }
        
        if (cleanValue.length > 1) {
            if (cleanValue.startsWith('0') && cleanValue[1] !== '.') {
                cleanValue = cleanValue.replace(/^0+/, '') || '0';
            }
        }
        
        return cleanValue;
    }

    // === 🔔 알림 시스템 ===
    function showNotification(message, type = 'info', duration = 4000) {
        try {
            if (window.APIService?.showNotification) {
                window.APIService.showNotification(message, type, duration);
            } else {
                console.log(`[Percent 알림 - ${type.toUpperCase()}] ${message}`);
                
                const notification = document.createElement('div');
                notification.style.cssText = `
                    position: fixed; top: 20px; right: 20px; padding: 12px 20px;
                    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
                    color: white; border-radius: 8px; z-index: 10000; font-size: 13px;
                    max-width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    font-family: 'Blinker', sans-serif; opacity: 0; transform: translateX(100%);
                    transition: all 0.3s ease; line-height: 1.4;
                `;
                notification.textContent = message;
                document.body.appendChild(notification);
                
                setTimeout(() => {
                    notification.style.opacity = '1';
                    notification.style.transform = 'translateX(0)';
                }, 10);
                
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.style.opacity = '0';
                        notification.style.transform = 'translateX(100%)';
                        setTimeout(() => notification.remove(), 300);
                    }
                }, duration);
            }
        } catch (error) {
            console.log(`[Percent 알림 오류] ${message} (${type})`);
        }
    }

    // === 📦 백업 및 복원 기능 ===
    function exportSettings() {
        try {
            const settingsData = {
                weights: {},
                api_data: {
                    member_count: appState.memberApiData.length,
                    party_count: appState.partyApiData.length,
                    bill_count: appState.billCountData.length
                },
                metadata: {
                    version: '5.0.0',
                    exportDate: new Date().toISOString(),
                    source: 'percent_api_integrated_v5',
                    lastApplied: appState.lastApplied?.toISOString(),
                    mode: 'api_integrated',
                    userId: appState.userId
                }
            };
            
            elements.percentInputs.forEach(input => {
                const label = input.dataset.item;
                settingsData.weights[label] = {
                    value: parseFloat(input.value.replace('%', '')) || 0,
                    enabled: !input.disabled
                };
            });
            
            const dataStr = JSON.stringify(settingsData, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `api_integrated_weight_settings_${new Date().toISOString().split('T')[0]}.json`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showNotification('API 통합 가중치 설정이 내보내기되었습니다', 'success');
            
        } catch (error) {
            console.error('[Percent] 설정 내보내기 실패:', error);
            showNotification('내보내기에 실패했습니다', 'error');
        }
    }

    function importSettings(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                
                if (!importedData.weights) {
                    throw new Error('유효하지 않은 설정 파일입니다');
                }
                
                // 설정 적용
                Object.entries(importedData.weights).forEach(([label, data]) => {
                    // 체크박스 업데이트
                    elements.checkboxInputs.forEach(checkbox => {
                        if (checkbox.dataset.item === label) {
                            checkbox.checked = data.enabled;
                        }
                    });
                    
                    // 입력값 업데이트
                    elements.percentInputs.forEach(input => {
                        if (input.dataset.item === label) {
                            input.value = data.value + '%';
                            input.disabled = !data.enabled;
                            updateInputStyle(input, data.enabled);
                        }
                    });
                });
                
                calculateAndDisplayTotal();
                scheduleAutoApply();
                
                showNotification('API 통합 가중치 설정이 가져오기되었습니다', 'success');
                
            } catch (error) {
                console.error('[Percent] 설정 가져오기 실패:', error);
                showNotification('가져오기에 실패했습니다: ' + error.message, 'error');
            }
        };
        
        reader.readAsText(file);
        event.target.value = '';
    }

    // === 🌐 전역 함수 등록 ===
    window.ApiIntegratedWeightSystem = {
        init: initializeApp,
        save: saveSettings,
        apply: applyWeightsToRanking,
        reset: resetToDefaults,
        loadApiData: loadAllApiData,
        calculateScores: calculateAndDistributeScores,
        getState: () => appState,
        getCurrentWeights: getCurrentActiveWeights,
        getMemberData: () => appState.memberApiData,
        getPartyData: () => appState.partyApiData,
        getCalculatedData: () => ({
            members: appState.calculatedMemberData,
            parties: appState.calculatedPartyData
        }),
        getUserId: () => appState.userId,
        version: '5.0.0'
    };

    // === 🔧 개발자 도구 (API 통합 버전) ===
    window.debugApiWeights = {
        state: appState,
        config: WEIGHT_CONFIG,
        getCurrentWeights: getCurrentActiveWeights,
        testNotification: (msg, type) => showNotification(msg, type),
        loadApiData: loadAllApiData,
        calculateScores: calculateAndDistributeScores,
        checkConnectedPages: checkConnectedPages,
        getUserId: () => appState.userId,
        
        // API 데이터 확인
        getMemberApiData: () => appState.memberApiData,
        getPartyApiData: () => appState.partyApiData,
        getBillCountData: () => appState.billCountData,
        
        // 계산된 데이터 확인
        getCalculatedMembers: () => appState.calculatedMemberData,
        getCalculatedParties: () => appState.calculatedPartyData,
        
        // API 테스트
        testMemberCalculation: (memberName) => {
            const member = appState.memberApiData.find(m => m.name === memberName);
            if (member) {
                const weights = getCurrentActiveWeights();
                console.log(`[Percent] ${memberName} 계산 테스트:`, member);
                console.log('가중치:', weights);
                return member;
            }
            return null;
        },
        
        testPartyCalculation: (partyName) => {
            const party = appState.partyApiData.find(p => p.name === partyName);
            if (party) {
                const weights = getCurrentActiveWeights();
                console.log(`[Percent] ${partyName} 계산 테스트:`, party);
                console.log('가중치:', weights);
                return party;
            }
            return null;
        },
        
        recreateChannel: () => {
            console.log('[Percent] BroadcastChannel 재생성 시도...');
            const success = createBroadcastChannel();
            console.log('[Percent] 재생성 결과:', success ? '성공' : '실패');
            return success;
        },
        
        getChannelStatus: () => {
            return {
                exists: !!window.weightUpdateChannel,
                type: typeof window.weightUpdateChannel,
                supported: typeof BroadcastChannel !== 'undefined'
            };
        },
        
        testBroadcast: (testData = { test: true, timestamp: new Date().toISOString() }) => {
            const success = safeBroadcast(testData);
            console.log('[Percent] 테스트 브로드캐스트 결과:', success ? '성공' : '실패');
            return success;
        },
        
        help: () => {
            console.log('[Percent] 🔧 API 통합 가중치 시스템 디버그 도구 (v5.0.0):');
            console.log('  API 관련:');
            console.log('  - loadApiData(): 3개 API 데이터 다시 로드');
            console.log('  - getMemberApiData(): 의원 API 데이터 확인');
            console.log('  - getPartyApiData(): 정당 API 데이터 확인');
            console.log('  - getBillCountData(): 법안 수 데이터 확인');
            console.log('  계산 관련:');
            console.log('  - calculateScores(): 가중치 기반 점수 재계산');
            console.log('  - getCalculatedMembers(): 계산된 의원 데이터');
            console.log('  - getCalculatedParties(): 계산된 정당 데이터');
            console.log('  - testMemberCalculation(name): 특정 의원 계산 테스트');
            console.log('  - testPartyCalculation(name): 특정 정당 계산 테스트');
            console.log('  통신 관련:');
            console.log('  - recreateChannel(): BroadcastChannel 재생성');
            console.log('  - testBroadcast(): 브로드캐스트 테스트');
            console.log('  - checkConnectedPages(): 연결된 페이지 확인');
        }
    };

    // === 🚀 앱 시작 ===
    initializeApp();

    console.log('[Percent] ✅ API 통합 가중치 시스템 로드 완료 (v5.0.0)');
    console.log('[Percent] 📡 API 통합 모드 - 3개 API 데이터 기반 점수 계산');
    console.log('[Percent] 👤 사용자 ID:', appState.userId);
    console.log('[Percent] 🔧 디버그: window.debugApiWeights.help()');
});
