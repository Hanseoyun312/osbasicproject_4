/**
 * rank_member.js (v3.3.0) - 클라이언트 사이드 가중치 연동 의원 랭킹 시스템 (완전 통합 버전)
 * 개선사항: rank_party.js와 동일한 구조로 통합, BroadcastChannel v4 통일, 향상된 검색 기능
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 클라이언트 가중치 연동 의원 랭킹 페이지 로드 시작 (v3.3.0)');

    // === 📊 페이지 상태 관리 ===
    let memberList = [];
    let memberRanking = [];
    let originalMemberData = [];  // 원본 데이터 보관
    let filteredMembers = [];
    let currentPage = 1;
    let itemsPerPage = 20;
    let totalPages = 1;
    let currentSort = 'asc';
    let currentFilter = 'all';
    let searchQuery = '';
    let isLoading = false;
    let hasError = false;
    let initialized = false;

    // 🎯 클라이언트 가중치 관련 상태
    let weightSyncState = {
        currentWeights: null,
        lastWeightUpdate: null,
        isRecalculating: false,
        realTimeUpdateChannel: null,
        percentPageConnected: false
    };
    
    // 🔍 향상된 검색 상태
    let searchState = {
        searchHistory: [],
        isSearching: false,
        searchResults: {
            total: 0,
            byName: 0,
            byParty: 0,
            exact: 0,
            partial: 0
        },
        searchHighlight: true,
        lastSearchTime: null
    };

    // === 🧮 가중치 계산 설정 ===
    const WEIGHT_CALCULATOR = {
        // percent.js와 동일한 매핑
        FIELD_MAPPING: {
            '간사': 'committee_secretary_count',
            '무효표 및 기권': 'invalid_vote_ratio',
            '본회의 가결': 'bill_pass_sum',
            '위원장': 'committee_leader_count',
            '청원 소개': 'petition_sum',
            '청원 결과': 'petition_pass_sum',
            '출석': 'attendance_rate',
            '투표 결과 일치': 'vote_match_ratio',
            '투표 결과 불일치': 'vote_mismatch_ratio'
        },

        // 데이터 정규화를 위한 기준값들 (실제 데이터에서 동적으로 계산)
        normalizationBounds: {
            committee_secretary_count: { min: 0, max: 10 },
            invalid_vote_ratio: { min: 0, max: 100 },
            bill_pass_sum: { min: 0, max: 500 },
            committee_leader_count: { min: 0, max: 5 },
            petition_sum: { min: 0, max: 200 },
            petition_pass_sum: { min: 0, max: 100 },
            attendance_rate: { min: 0, max: 100 },
            vote_match_ratio: { min: 0, max: 100 },
            vote_mismatch_ratio: { min: 0, max: 100 }
        }
    };

    // === 📡 안전한 BroadcastChannel 관리 ===
    function createBroadcastChannel() {
        if (typeof BroadcastChannel === 'undefined') {
            console.warn('[RankMember] ⚠️ BroadcastChannel을 지원하지 않는 브라우저입니다');
            return false;
        }

        try {
            // 기존 채널이 있으면 정리
            if (weightSyncState.realTimeUpdateChannel) {
                try {
                    weightSyncState.realTimeUpdateChannel.close();
                } catch (e) {
                    // 이미 닫혔을 수 있음
                }
            }

            // 🔧 통일된 채널명 사용 (v4)
            weightSyncState.realTimeUpdateChannel = new BroadcastChannel('client_weight_updates_v4');
            
            weightSyncState.realTimeUpdateChannel.addEventListener('message', async function(event) {
                try {
                    const data = event.data;
                    console.log('[RankMember] 📡 가중치 업데이트 수신:', data);
                    
                    if (data.type === 'client_weights_updated' && data.source === 'percent_page') {
                        await handleClientWeightUpdate(data);
                    } else if (data.type === 'connection_check') {
                        // percent 페이지의 연결 확인 요청에 응답
                        safeBroadcast({
                            type: 'connection_response',
                            source: 'rank_member_page',
                            timestamp: new Date().toISOString(),
                            status: 'connected'
                        });
                        weightSyncState.percentPageConnected = true;
                        updateConnectionStatus();
                    }
                } catch (error) {
                    console.warn('[RankMember] 메시지 처리 실패:', error);
                }
            });

            // 채널 오류 처리
            weightSyncState.realTimeUpdateChannel.addEventListener('error', function(error) {
                console.warn('[RankMember] BroadcastChannel 오류:', error);
                // 채널 재생성 시도
                setTimeout(createBroadcastChannel, 1000);
            });
            
            console.log('[RankMember] ✅ BroadcastChannel 초기화 완료 (v4)');
            return true;
            
        } catch (error) {
            console.error('[RankMember] BroadcastChannel 초기화 실패:', error);
            weightSyncState.realTimeUpdateChannel = null;
            return false;
        }
    }

    // === 📡 안전한 브로드캐스트 함수 ===
    function safeBroadcast(data) {
        try {
            if (!weightSyncState.realTimeUpdateChannel) {
                // 채널이 없으면 재생성 시도
                if (!createBroadcastChannel()) {
                    return false;
                }
            }

            weightSyncState.realTimeUpdateChannel.postMessage(data);
            return true;
            
        } catch (error) {
            console.warn('[RankMember] 브로드캐스트 실패, 채널 재생성 시도:', error);
            
            // 채널 재생성 시도
            if (createBroadcastChannel()) {
                try {
                    weightSyncState.realTimeUpdateChannel.postMessage(data);
                    return true;
                } catch (retryError) {
                    console.warn('[RankMember] 재시도 후에도 브로드캐스트 실패:', retryError);
                }
            }
            
            return false;
        }
    }

    // === 🔗 실시간 연동 시스템 초기화 ===
    function initializeRealTimeSync() {
        console.log('[RankMember] 🔗 클라이언트 가중치 연동 시스템 초기화...');
        
        try {
            // 1. BroadcastChannel 설정
            createBroadcastChannel();
            
            // 2. localStorage 이벤트 감지
            window.addEventListener('storage', function(e) {
                if (e.key === 'client_weight_change_event' && !weightSyncState.isRecalculating) {
                    try {
                        const eventData = JSON.parse(e.newValue);
                        console.log('[RankMember] 📢 localStorage 가중치 변경 감지:', eventData);
                        handleClientWeightUpdate(eventData);
                    } catch (error) {
                        console.warn('[RankMember] localStorage 이벤트 파싱 실패:', error);
                    }
                }
            });
            
            // 3. 저장된 가중치 확인 및 로드
            loadStoredWeights();
            
            console.log('[RankMember] ✅ 실시간 연동 시스템 초기화 완료');
            
        } catch (error) {
            console.error('[RankMember] 실시간 연동 시스템 초기화 실패:', error);
        }
    }

    // === 💾 저장된 가중치 로드 ===
    function loadStoredWeights() {
        try {
            const storedWeights = localStorage.getItem('current_weights');
            if (storedWeights) {
                const weightData = JSON.parse(storedWeights);
                console.log('[RankMember] 📥 저장된 가중치 로드:', weightData);
                
                weightSyncState.currentWeights = weightData.weights;
                weightSyncState.lastWeightUpdate = new Date(weightData.timestamp);
                
                // 데이터가 이미 로드되었다면 즉시 재계산
                if (originalMemberData.length > 0) {
                    recalculateMemberScores();
                }
            } else {
                console.log('[RankMember] 📋 저장된 가중치 없음 - 기본 점수 사용');
            }
        } catch (error) {
            console.error('[RankMember] 저장된 가중치 로드 실패:', error);
        }
    }

    // === 🎯 핵심: 클라이언트 가중치 업데이트 처리 ===
    async function handleClientWeightUpdate(eventData) {
        if (weightSyncState.isRecalculating) {
            console.log('[RankMember] 🔄 이미 재계산 중입니다.');
            return;
        }

        try {
            weightSyncState.isRecalculating = true;
            
            console.log('[RankMember] 🎯 클라이언트 가중치 업데이트 시작...');
            
            // 🔍 현재 검색 상태 저장
            const currentSearchState = {
                query: searchQuery,
                filter: currentFilter,
                sort: currentSort,
                page: currentPage
            };
            
            // 사용자에게 알림
            showWeightUpdateNotification('가중치가 변경되었습니다. 의원 순위를 재계산하는 중...', 'info', 3000);
            
            // 로딩 상태 표시
            setLoadingState(true, '새로운 가중치로 순위 재계산 중...');
            
            // 가중치 업데이트
            weightSyncState.currentWeights = eventData.weights;
            weightSyncState.lastWeightUpdate = new Date(eventData.timestamp);
            
            // 🧮 의원 점수 재계산
            await recalculateMemberScores();
            
            // 🔍 검색 상태 복원
            await restoreSearchState(currentSearchState);
            
            // 성공 알림
            showWeightUpdateNotification('✅ 의원 순위가 새로운 가중치로 업데이트되었습니다!', 'success', 4000);
            
            console.log('[RankMember] ✅ 클라이언트 가중치 업데이트 완료');
            
        } catch (error) {
            console.error('[RankMember] ❌ 클라이언트 가중치 업데이트 실패:', error);
            showWeightUpdateNotification(`순위 업데이트 실패: ${error.message}`, 'error', 5000);
        } finally {
            weightSyncState.isRecalculating = false;
            setLoadingState(false);
        }
    }

    // === 🔍 검색 상태 복원 ===
    async function restoreSearchState(searchState) {
        try {
            console.log('[RankMember] 🔍 검색 상태 복원:', searchState);
            
            // 검색어 복원
            if (searchState.query) {
                searchQuery = searchState.query;
                if (elements.searchInput) {
                    elements.searchInput.value = searchState.query;
                }
            }
            
            // 필터 복원
            currentFilter = searchState.filter;
            if (elements.filterButtons) {
                elements.filterButtons.forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.filter === searchState.filter);
                });
            }
            
            // 정렬 복원
            currentSort = searchState.sort;
            if (elements.sortDropdown) {
                elements.sortDropdown.querySelectorAll('.dropdown-item').forEach(item => {
                    item.classList.toggle('active', item.dataset.sort === searchState.sort);
                });
            }
            
            // 필터 및 검색 적용
            applyCurrentFiltersAndSort();
            
            // 페이지 복원 (데이터 범위 내에서)
            const maxPage = Math.ceil(filteredMembers.length / itemsPerPage);
            currentPage = Math.min(searchState.page, maxPage) || 1;
            
            // UI 업데이트
            renderTable();
            renderPagination();
            
            // 검색 결과 업데이트
            if (searchQuery) {
                updateSearchResults();
                showSearchInfo();
            }
            
            console.log('[RankMember] ✅ 검색 상태 복원 완료');
            
        } catch (error) {
            console.error('[RankMember] ❌ 검색 상태 복원 실패:', error);
        }
    }

    // === 🧮 핵심: 의원 점수 재계산 ===
    async function recalculateMemberScores() {
        try {
            console.log('[RankMember] 🧮 의원 점수 재계산 시작...');
            
            if (!weightSyncState.currentWeights) {
                console.log('[RankMember] ⚠️ 가중치가 없어서 기본 점수 사용');
                return;
            }
            
            if (originalMemberData.length === 0) {
                console.log('[RankMember] ⚠️ 원본 데이터가 없어서 재계산 불가');
                return;
            }
            
            // 1. 정규화 기준값 계산
            const bounds = calculateNormalizationBounds(originalMemberData);
            
            // 2. 각 의원의 점수 재계산
            const recalculatedMembers = originalMemberData.map((member, index) => {
                const newScore = calculateMemberScore(member, weightSyncState.currentWeights, bounds);
                
                return {
                    ...member,
                    calculatedScore: newScore,
                    rank: 0, // 임시값, 나중에 재정렬 후 계산
                    scoreSource: 'client_calculated',
                    lastUpdated: new Date().toISOString(),
                    weightApplied: true
                };
            });
            
            // 3. 점수 기준으로 정렬하여 순위 부여
            recalculatedMembers.sort((a, b) => b.calculatedScore - a.calculatedScore);
            recalculatedMembers.forEach((member, index) => {
                member.rank = index + 1;
            });
            
            // 4. filteredMembers 업데이트 (🔍 중요: 원본 데이터 참조 유지)
            filteredMembers = recalculatedMembers;
            
            // 5. 업데이트 정보 표시
            showScoreUpdateInfo(recalculatedMembers.length);
            
            console.log('[RankMember] ✅ 의원 점수 재계산 완료');
            
        } catch (error) {
            console.error('[RankMember] ❌ 의원 점수 재계산 실패:', error);
            throw error;
        }
    }

    // === 🧮 정규화 기준값 계산 ===
    function calculateNormalizationBounds(memberData) {
        const bounds = {};
        
        Object.values(WEIGHT_CALCULATOR.FIELD_MAPPING).forEach(field => {
            const values = memberData
                .map(member => getFieldValue(member, field))
                .filter(val => !isNaN(val) && val !== null && val !== undefined);
            
            if (values.length > 0) {
                bounds[field] = {
                    min: Math.min(...values),
                    max: Math.max(...values)
                };
            } else {
                bounds[field] = WEIGHT_CALCULATOR.normalizationBounds[field] || { min: 0, max: 100 };
            }
            
            // 최대값과 최소값이 같으면 범위를 1로 설정 (0으로 나누기 방지)
            if (bounds[field].max === bounds[field].min) {
                bounds[field].max = bounds[field].min + 1;
            }
        });
        
        console.log('[RankMember] 📊 정규화 기준값:', bounds);
        return bounds;
    }

    // === 🧮 개별 의원 점수 계산 ===
    function calculateMemberScore(member, weights, bounds) {
        let totalScore = 0;
        let totalWeight = 0;
        
        Object.entries(weights).forEach(([weightLabel, weightValue]) => {
            const fieldName = WEIGHT_CALCULATOR.FIELD_MAPPING[weightLabel];
            
            if (fieldName && bounds[fieldName]) {
                const rawValue = getFieldValue(member, fieldName);
                const normalizedValue = normalizeValue(rawValue, bounds[fieldName]);
                const weightedValue = normalizedValue * weightValue;
                
                totalScore += weightedValue;
                totalWeight += weightValue;
                
                // 디버그 로그 (처음 몇 개만)
                if (member.name === originalMemberData[0]?.name) {
                    console.log(`[RankMember] 📊 ${member.name} - ${weightLabel}: raw=${rawValue}, norm=${normalizedValue.toFixed(3)}, weight=${weightValue}, weighted=${weightedValue.toFixed(3)}`);
                }
            }
        });
        
        // 0-100 범위로 변환
        const finalScore = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;
        
        return Math.round(finalScore * 10) / 10; // 소수점 첫째자리까지
    }

    // === 🔧 유틸리티: 필드값 추출 ===
    function getFieldValue(member, fieldName) {
        // 다양한 필드명 매핑 시도
        const possibleFields = [
            fieldName,
            // 성과 데이터에서
            member._performance?.[fieldName],
            // 랭킹 데이터에서
            member._ranking?.[fieldName],
            // 직접 필드에서
            member[fieldName],
            // 다른 필드명 변형들
            member[fieldName.replace('_', '')],
            member[fieldName.toUpperCase()],
            member[fieldName.toLowerCase()]
        ];
        
        for (const field of possibleFields) {
            if (field !== undefined && field !== null && !isNaN(parseFloat(field))) {
                return parseFloat(field);
            }
        }
        
        // 특별한 경우 처리
        switch (fieldName) {
            case 'attendance_rate':
                return parseFloat(member.attendanceRate || member.출석률 || 85);
            case 'bill_pass_sum':
                return parseInt(member.billPassSum || member.본회의가결 || 0);
            case 'petition_sum':
                return parseInt(member.petitionSum || member.청원수 || 0);
            case 'petition_pass_sum':
                return parseInt(member.petitionPassSum || member.청원가결 || 0);
            case 'committee_leader_count':
                return parseInt(member.chairmanCount || member.위원장수 || 0);
            case 'committee_secretary_count':
                return parseInt(member.secretaryCount || member.간사수 || 0);
            case 'invalid_vote_ratio':
                return parseFloat(member.invalidVoteRatio || member.무효표비율 || 2);
            case 'vote_match_ratio':
                return parseFloat(member.voteMatchRatio || member.표결일치율 || 85);
            case 'vote_mismatch_ratio':
                return parseFloat(member.voteMismatchRatio || member.표결불일치율 || 15);
            default:
                return 0;
        }
    }

    // === 🧮 값 정규화 (0-1 범위로) ===
    function normalizeValue(value, bounds) {
        if (isNaN(value) || bounds.max === bounds.min) {
            return 0;
        }
        
        const normalized = (value - bounds.min) / (bounds.max - bounds.min);
        return Math.max(0, Math.min(1, normalized)); // 0-1 범위로 제한
    }

    // === 📊 점수 업데이트 정보 표시 ===
    function showScoreUpdateInfo(updatedCount) {
        try {
            let infoElement = document.getElementById('member-score-update-info');
            if (!infoElement) {
                infoElement = document.createElement('div');
                infoElement.id = 'member-score-update-info';
                infoElement.style.cssText = `
                    margin: 10px 0; padding: 12px 18px; 
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    color: white; border-radius: 10px; font-size: 14px; text-align: center;
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25); 
                    animation: slideInMember 0.6s ease-out;
                `;
                
                const tableContainer = document.querySelector('.main') || document.body;
                const table = document.querySelector('.member-table');
                if (table && table.parentNode) {
                    table.parentNode.insertBefore(infoElement, table);
                } else {
                    tableContainer.appendChild(infoElement);
                }
            }
            
            const weightInfo = weightSyncState.currentWeights ? 
                `(${Object.keys(weightSyncState.currentWeights).length}개 가중치 적용)` : '';
            
            const searchInfo = searchQuery ? 
                ` | 검색: "${searchQuery}"` : '';
            
            infoElement.innerHTML = `
                <div style="display: flex; justify-content: center; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <span style="font-size: 18px;">👤</span>
                    <span><strong>${updatedCount}명</strong>의 의원 점수가 클라이언트에서 재계산되었습니다! ${weightInfo}${searchInfo}</span>
                    <span style="font-size: 11px; opacity: 0.9;">${new Date().toLocaleTimeString('ko-KR')}</span>
                </div>
            `;
            
            // 애니메이션 스타일 추가
            if (!document.getElementById('member-score-update-styles')) {
                const style = document.createElement('style');
                style.id = 'member-score-update-styles';
                style.textContent = `
                    @keyframes slideInMember {
                        from { opacity: 0; transform: translateY(-12px) scale(0.95); }
                        to { opacity: 1; transform: translateY(0) scale(1); }
                    }
                `;
                document.head.appendChild(style);
            }
            
            // 8초 후 자동 숨김
            setTimeout(() => {
                if (infoElement.parentNode) {
                    infoElement.style.opacity = '0';
                    infoElement.style.transform = 'translateY(-12px) scale(0.95)';
                    setTimeout(() => infoElement.remove(), 400);
                }
            }, 8000);
            
        } catch (error) {
            console.warn('[RankMember] 점수 업데이트 정보 표시 실패:', error);
        }
    }

    // === 🔔 가중치 업데이트 전용 알림 시스템 ===
    function showWeightUpdateNotification(message, type = 'info', duration = 4000) {
        try {
            // 기존 가중치 알림 제거
            const existingNotification = document.querySelector('.member-weight-update-notification');
            if (existingNotification) {
                existingNotification.remove();
            }
            
            const notification = document.createElement('div');
            notification.className = 'member-weight-update-notification';
            notification.style.cssText = `
                position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
                padding: 14px 25px; border-radius: 10px; z-index: 10001; font-size: 14px;
                max-width: 500px; box-shadow: 0 6px 18px rgba(0,0,0,0.15);
                font-family: 'Blinker', sans-serif; font-weight: 500; text-align: center;
                opacity: 0; transform: translateX(-50%) translateY(-20px);
                transition: all 0.4s ease; line-height: 1.4;
                background: ${type === 'success' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 
                           type === 'error' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 
                           type === 'warning' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 
                           'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'};
                color: white;
            `;
            
            notification.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                    <span style="font-size: 16px;">${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
                    <span>${message}</span>
                    <span style="font-size: 16px;">👤</span>
                </div>
            `;
            
            document.body.appendChild(notification);
            
            // 애니메이션 시작
            setTimeout(() => {
                notification.style.opacity = '1';
                notification.style.transform = 'translateX(-50%) translateY(0)';
            }, 10);
            
            // 자동 제거
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.style.opacity = '0';
                    notification.style.transform = 'translateX(-50%) translateY(-20px)';
                    setTimeout(() => notification.remove(), 400);
                }
            }, duration);
            
        } catch (error) {
            console.log(`[RankMember 가중치 알림] ${message} (${type})`);
        }
    }

    // === 🎨 연결 상태 표시 업데이트 ===
    function updateConnectionStatus() {
        try {
            let statusElement = document.getElementById('member-weight-sync-status');
            if (!statusElement) {
                statusElement = document.createElement('div');
                statusElement.id = 'member-weight-sync-status';
                statusElement.style.cssText = `
                    position: fixed; top: 10px; right: 10px; z-index: 1000;
                    padding: 8px 12px; background: rgba(59, 130, 246, 0.9); color: white;
                    border-radius: 20px; font-size: 11px; font-weight: 500;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1); backdrop-filter: blur(4px);
                    transition: all 0.3s ease; font-family: 'Blinker', sans-serif;
                `;
                document.body.appendChild(statusElement);
            }
            
            const hasWeights = weightSyncState.currentWeights !== null;
            
            if (weightSyncState.percentPageConnected && hasWeights) {
                statusElement.style.background = 'rgba(16, 185, 129, 0.9)';
                statusElement.innerHTML = '🔗 의원 가중치 연동됨';
            } else if (hasWeights) {
                statusElement.style.background = 'rgba(245, 158, 11, 0.9)';
                statusElement.innerHTML = '⚖️ 가중치 적용됨';
            } else if (weightSyncState.percentPageConnected) {
                statusElement.style.background = 'rgba(59, 130, 246, 0.9)';
                statusElement.innerHTML = '⏳ 가중치 대기중';
            } else {
                statusElement.style.background = 'rgba(107, 114, 128, 0.9)';
                statusElement.innerHTML = '📴 기본 순위';
            }
            
        } catch (error) {
            console.warn('[RankMember] 연결 상태 표시 업데이트 실패:', error);
        }
    }

    // === 📋 DOM 요소 캐시 ===
    const elements = {
        memberTableBody: null,
        pagination: null,
        searchInput: null,
        searchButton: null,
        searchClearButton: null,
        filterButtons: null,
        settingsBtn: null,
        sortDropdown: null,
        searchResults: null
    };

    // DOM 요소 초기화
    function initializeElements() {
        elements.memberTableBody = document.getElementById('memberTableBody');
        elements.pagination = document.getElementById('pagination');
        elements.searchInput = document.getElementById('searchInput');
        elements.searchButton = document.getElementById('searchButton');
        elements.filterButtons = document.querySelectorAll('.filter-btn');
        elements.settingsBtn = document.getElementById('settingsBtn');
        elements.sortDropdown = document.getElementById('sortDropdown');
        
        // 🔍 검색 관련 요소 추가 생성
        createEnhancedSearchUI();
    }

    // === 🔍 향상된 검색 UI 생성 ===
    function createEnhancedSearchUI() {
        try {
            // 검색 결과 정보 표시 영역 생성
            if (!elements.searchResults) {
                elements.searchResults = document.createElement('div');
                elements.searchResults.id = 'searchResults';
                elements.searchResults.style.cssText = `
                    margin: 10px 0; padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0;
                    border-radius: 6px; font-size: 13px; color: #64748b; display: none;
                `;
                
                // 검색 입력 필드 다음에 추가
                if (elements.searchInput && elements.searchInput.parentNode) {
                    elements.searchInput.parentNode.insertAdjacentElement('afterend', elements.searchResults);
                }
            }
            
            // 검색어 클리어 버튼 생성
            if (!elements.searchClearButton && elements.searchInput) {
                const searchContainer = elements.searchInput.parentNode;
                if (searchContainer && searchContainer.style.position !== 'relative') {
                    searchContainer.style.position = 'relative';
                    
                    elements.searchClearButton = document.createElement('button');
                    elements.searchClearButton.innerHTML = '✕';
                    elements.searchClearButton.style.cssText = `
                        position: absolute; right: 35px; top: 50%; transform: translateY(-50%);
                        background: none; border: none; color: #9ca3af; cursor: pointer;
                        font-size: 14px; padding: 5px; display: none; z-index: 10;
                        border-radius: 50%; width: 20px; height: 20px; line-height: 1;
                    `;
                    elements.searchClearButton.title = '검색어 지우기';
                    
                    searchContainer.appendChild(elements.searchClearButton);
                    
                    // 클리어 버튼 이벤트
                    elements.searchClearButton.addEventListener('click', clearSearch);
                }
            }
            
            console.log('[RankMember] ✅ 향상된 검색 UI 생성 완료');
            
        } catch (error) {
            console.warn('[RankMember] 향상된 검색 UI 생성 실패:', error);
        }
    }

    // === 🔍 검색어 클리어 ===
    function clearSearch() {
        try {
            if (elements.searchInput) {
                elements.searchInput.value = '';
            }
            
            searchQuery = '';
            currentPage = 1;
            
            // 검색 결과 정보 숨김
            hideSearchResults();
            
            // 클리어 버튼 숨김
            if (elements.searchClearButton) {
                elements.searchClearButton.style.display = 'none';
            }
            
            // 필터 및 정렬 적용
            applyCurrentFiltersAndSort();
            renderTable();
            
            console.log('[RankMember] 🔍 검색어 클리어 완료');
            
        } catch (error) {
            console.error('[RankMember] 검색어 클리어 실패:', error);
        }
    }

    // === 🔍 검색 결과 정보 표시 ===
    function showSearchInfo() {
        try {
            if (!elements.searchResults || !searchQuery) {
                hideSearchResults();
                return;
            }
            
            const results = searchState.searchResults;
            const query = searchQuery;
            
            elements.searchResults.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                        🔍 "<strong>${escapeHtml(query)}</strong>" 검색결과: <strong>${results.total}명</strong>
                        ${results.exact > 0 ? `(정확일치 ${results.exact}명)` : ''}
                        ${results.byName > 0 ? `• 이름 ${results.byName}명` : ''}
                        ${results.byParty > 0 ? `• 정당 ${results.byParty}명` : ''}
                    </div>
                    <div style="font-size: 11px; opacity: 0.7;">
                        ${new Date().toLocaleTimeString('ko-KR')}
                    </div>
                </div>
            `;
            
            elements.searchResults.style.display = 'block';
            
            // 클리어 버튼 표시
            if (elements.searchClearButton) {
                elements.searchClearButton.style.display = 'block';
            }
            
        } catch (error) {
            console.warn('[RankMember] 검색 결과 정보 표시 실패:', error);
        }
    }

    // === 🔍 검색 결과 정보 숨김 ===
    function hideSearchResults() {
        try {
            if (elements.searchResults) {
                elements.searchResults.style.display = 'none';
            }
        } catch (error) {
            console.warn('[RankMember] 검색 결과 정보 숨김 실패:', error);
        }
    }

    // === 🔍 검색 결과 분석 ===
    function updateSearchResults() {
        try {
            const query = searchQuery.toLowerCase().trim();
            if (!query) {
                searchState.searchResults = { total: 0, byName: 0, byParty: 0, exact: 0, partial: 0 };
                return;
            }
            
            let exactMatches = 0;
            let partialMatches = 0;
            let nameMatches = 0;
            let partyMatches = 0;
            
            filteredMembers.forEach(member => {
                const name = member.name.toLowerCase();
                const party = member.party.toLowerCase();
                
                const nameExact = name === query;
                const partyExact = party === query;
                const namePartial = name.includes(query);
                const partyPartial = party.includes(query);
                
                if (nameExact || partyExact) {
                    exactMatches++;
                }
                
                if (namePartial || partyPartial) {
                    partialMatches++;
                    
                    if (namePartial) nameMatches++;
                    if (partyPartial) partyMatches++;
                }
            });
            
            searchState.searchResults = {
                total: filteredMembers.length,
                byName: nameMatches,
                byParty: partyMatches,
                exact: exactMatches,
                partial: partialMatches
            };
            
            searchState.lastSearchTime = new Date();
            
        } catch (error) {
            console.warn('[RankMember] 검색 결과 분석 실패:', error);
        }
    }

    // === 🔍 텍스트 하이라이팅 ===
    function highlightText(text, query) {
        if (!query || !searchState.searchHighlight) return escapeHtml(text);
        
        try {
            const escapedText = escapeHtml(text);
            const escapedQuery = escapeHtml(query);
            const regex = new RegExp(`(${escapedQuery})`, 'gi');
            
            return escapedText.replace(regex, '<mark style="background: #fbbf24; padding: 1px 2px; border-radius: 2px;">$1</mark>');
        } catch (error) {
            return escapeHtml(text);
        }
    }

    // === 🔧 HTML 이스케이프 ===
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 로딩 상태 관리
    function setLoadingState(loading, message = '국회의원 데이터를 불러오는 중...') {
        isLoading = loading;
        
        if (elements.memberTableBody) {
            if (loading) {
                elements.memberTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 40px; color: var(--example);">
                            <div class="loading-spinner"></div>
                            ${message}
                        </td>
                    </tr>
                `;
            }
        }
        
        if (elements.searchButton) {
            elements.searchButton.disabled = loading;
        }
        
        // 🔍 검색 중 상태 표시
        searchState.isSearching = loading;
    }

    // 알림 표시
    function showNotification(message, type = 'info', duration = 3000) {
        if (window.APIService && window.APIService.showNotification) {
            window.APIService.showNotification(message, type, duration);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    // === 🚀 기존 API 데이터 로드 함수 (rank_party.js 스타일로 통합) ===
    async function loadAllData() {
        try {
            setLoadingState(true);
            console.log('[RankMember] 🚀 데이터 로드 시작...');
            
            if (!window.APIService || !window.APIService._isReady) {
                throw new Error('API 서비스가 준비되지 않았습니다.');
            }
            
            const results = await Promise.allSettled([
                window.APIService.getAllMembers(),
                window.APIService.getMemberRanking(),
                window.APIService.getMemberPerformance()
            ]);
            
            const [membersResult, rankingResult, performanceResult] = results;
            
            if (membersResult.status === 'fulfilled') {
                memberList = membersResult.value || [];
                console.log(`[RankMember] ✅ 국회의원 명단: ${memberList.length}명`);
            } else {
                console.error('[RankMember] ❌ 국회의원 명단 로드 실패:', membersResult.reason);
                throw new Error('국회의원 명단을 불러올 수 없습니다.');
            }
            
            if (rankingResult.status === 'fulfilled') {
                memberRanking = rankingResult.value || [];
                console.log(`[RankMember] ✅ 랭킹 데이터: ${memberRanking.length}개`);
            } else {
                console.warn('[RankMember] ⚠️ 랭킹 데이터 로드 실패:', rankingResult.reason);
                memberRanking = [];
            }

            // 성과 데이터도 로드 (가중치 계산에 필요한 상세 정보)
            let memberPerformanceData = [];
            if (performanceResult.status === 'fulfilled') {
                memberPerformanceData = performanceResult.value || [];
                console.log(`[RankMember] ✅ 성과 데이터: ${memberPerformanceData.length}개`);
            }
            
            // 🎯 원본 데이터 병합 및 보관
            mergeAndStoreOriginalData(memberPerformanceData);
            
            // 가중치가 있으면 즉시 재계산, 없으면 기본 처리
            if (weightSyncState.currentWeights) {
                await recalculateMemberScores();
            } else {
                mergeAndProcessData();
            }
            
            console.log('[RankMember] ✅ 데이터 로드 완료');
            return true;
            
        } catch (error) {
            console.error('[RankMember] ❌ 데이터 로드 실패:', error);
            hasError = true;
            showNotification('데이터 로드에 실패했습니다.', 'error');
            
            memberList = getFallbackData();
            memberRanking = [];
            mergeAndProcessData();
            
            throw error;
        } finally {
            setLoadingState(false);
        }
    }

    // === 🎯 원본 데이터 병합 및 저장 ===
    function mergeAndStoreOriginalData(performanceData) {
        try {
            console.log('[RankMember] 📊 원본 데이터 병합 중...');
            
            originalMemberData = memberList.map((member, index) => {
                const memberName = member.name || '';
                const ranking = memberRanking.find(r => r.HG_NM === memberName);
                const performance = performanceData.find(p => p.lawmaker_name === memberName);
                
                return {
                    // 기본 정보
                    rank: ranking ? parseInt(ranking.총점_순위) || (index + 1) : (index + 1),
                    name: memberName,
                    party: member.party || '정당 정보 없음',
                    contact: member.phone || '',
                    homepage: member.homepage || '',
                    originalIndex: index,
                    
                    // 🎯 가중치 계산에 필요한 상세 데이터
                    attendanceRate: parseFloat(performance?.attendance_rate || ranking?.출석률 || 85),
                    billPassSum: parseInt(performance?.bill_pass_sum || ranking?.본회의가결 || 0),
                    petitionSum: parseInt(performance?.petition_sum || ranking?.청원수 || 0),
                    petitionPassSum: parseInt(performance?.petition_pass_sum || ranking?.청원가결 || 0),
                    chairmanCount: parseInt(performance?.committee_leader_count || ranking?.위원장수 || 0),
                    secretaryCount: parseInt(performance?.committee_secretary_count || ranking?.간사수 || 0),
                    invalidVoteRatio: parseFloat(performance?.invalid_vote_ratio || ranking?.무효표비율 || 2),
                    voteMatchRatio: parseFloat(performance?.vote_match_ratio || ranking?.표결일치율 || 85),
                    voteMismatchRatio: parseFloat(performance?.vote_mismatch_ratio || ranking?.표결불일치율 || 15),
                    
                    // 원본 데이터 참조
                    _member: member,
                    _ranking: ranking,
                    _performance: performance
                };
            });
            
            console.log(`[RankMember] ✅ 원본 데이터 병합 완료: ${originalMemberData.length}명`);
            
        } catch (error) {
            console.error('[RankMember] ❌ 원본 데이터 병합 실패:', error);
            originalMemberData = [];
        }
    }

    // 기존 데이터 병합 및 처리 (가중치 없을 때 사용)
    function mergeAndProcessData() {
        try {
            if (originalMemberData.length > 0) {
                // 원본 데이터가 있으면 그대로 사용
                filteredMembers = [...originalMemberData];
            } else {
                // 원본 데이터가 없으면 기본 처리
                filteredMembers = memberList.map((member, index) => {
                    const memberName = member.name || '';
                    const ranking = memberRanking.find(r => r.HG_NM === memberName);
                    
                    return {
                        rank: ranking ? parseInt(ranking.총점_순위) || (index + 1) : (index + 1),
                        name: memberName,
                        party: member.party || '정당 정보 없음',
                        contact: member.phone || '',
                        homepage: member.homepage || '',
                        originalIndex: index
                    };
                });
            }
            
            applyCurrentFiltersAndSort();
            renderTable();
            
            console.log(`[RankMember] 📊 기본 데이터 처리 완료: ${filteredMembers.length}명`);
            
        } catch (error) {
            console.error('[RankMember] ❌ 데이터 처리 실패:', error);
            filteredMembers = [];
            renderTable();
        }
    }

    // === 🔄 필터 및 정렬 적용 (향상된 검색 포함) ===
    function applyCurrentFiltersAndSort() {
        // 원본 데이터에서 시작
        let workingData = [...originalMemberData];
        
        if (workingData.length === 0) {
            workingData = [...memberList.map((member, index) => ({
                rank: index + 1,
                name: member.name || '',
                party: member.party || '정당 정보 없음',
                contact: member.phone || '',
                homepage: member.homepage || '',
                originalIndex: index
            }))];
        }
        
        // 1. 정렬 적용
        workingData.sort((a, b) => {
            if (currentSort === 'asc') {
                return a.rank - b.rank;
            } else {
                return b.rank - a.rank;
            }
        });
        
        // 2. 정당 필터 적용
        if (currentFilter !== 'all') {
            workingData = workingData.filter(member => member.party === currentFilter);
        }
        
        // 3. 🔍 검색 필터 적용 (향상된 검색)
        if (searchQuery.trim()) {
            workingData = applyEnhancedSearch(workingData, searchQuery.trim());
        }
        
        // 4. 결과 저장
        filteredMembers = workingData;
        
        // 5. 🔍 검색 결과 분석
        updateSearchResults();
        
        // 6. 페이지네이션 계산
        calculatePagination();
    }

    // === 🔍 향상된 검색 적용 ===
    function applyEnhancedSearch(data, query) {
        const lowerQuery = query.toLowerCase();
        
        return data.filter(member => {
            const name = (member.name || '').toLowerCase();
            const party = (member.party || '').toLowerCase();
            const contact = (member.contact || '').toLowerCase();
            
            // 다양한 검색 조건
            return name.includes(lowerQuery) ||          // 이름 부분 검색
                   party.includes(lowerQuery) ||         // 정당 부분 검색
                   contact.includes(lowerQuery) ||       // 연락처 검색
                   name === lowerQuery ||                // 이름 정확 일치
                   party === lowerQuery;                 // 정당 정확 일치
        });
    }

    // 폴백 데이터
    function getFallbackData() {
        return [
            {
                name: '나경원',
                party: '국민의힘',
                phone: '02-788-2721',
                homepage: 'https://www.assembly.go.kr'
            },
            {
                name: '이재명',
                party: '더불어민주당',
                phone: '02-788-2922',
                homepage: 'https://www.assembly.go.kr'
            },
            {
                name: '조국',
                party: '조국혁신당',
                phone: '02-788-2923',
                homepage: 'https://www.assembly.go.kr'
            }
        ];
    }

    // === 기존 함수들 (정렬, 필터, 렌더링 등) 유지 ===
    function calculatePagination() {
        totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
        
        if (currentPage > totalPages) {
            currentPage = 1;
        }
    }

    function renderTable() {
        if (!elements.memberTableBody) return;
        
        if (filteredMembers.length === 0) {
            const message = hasError ? 
                '데이터 로드에 실패했습니다.' : 
                searchQuery ? 
                    `"${searchQuery}" 검색 결과가 없습니다.` : 
                    '표시할 데이터가 없습니다.';
            
            elements.memberTableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 40px; color: var(--example);">
                        ${message}
                        ${searchQuery ? 
                            '<br><button onclick="clearSearch()" style="margin-top: 10px; padding: 5px 15px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">검색어 지우기</button>' : 
                            ''
                        }
                    </td>
                </tr>
            `;
            renderPagination();
            hideSearchResults();
            return;
        }
        
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const currentPageMembers = filteredMembers.slice(startIndex, endIndex);
        
        const tableHTML = currentPageMembers.map(member => `
            <tr>
                <td class="rank-cell">
                    ${member.rank}
                    ${member.scoreSource === 'client_calculated' ? 
                        '<span style="color: #10b981; font-size: 10px; margin-left: 5px;" title="클라이언트 가중치 적용">⚖️</span>' : 
                        member.weightApplied ? 
                        '<span style="color: #3b82f6; font-size: 10px; margin-left: 5px;" title="가중치 적용됨">🎯</span>' : ''
                    }
                </td>
                <td>
                    <a href="percent_member.html?member=${encodeURIComponent(member.name)}" 
                       class="member-name">${highlightText(member.name, searchQuery)}</a>
                    ${member.calculatedScore ? 
                        `<div style="font-size: 11px; color: #059669; margin-top: 2px;">점수: ${member.calculatedScore}</div>` : ''
                    }
                </td>
                <td class="party-name">${highlightText(member.party, searchQuery)}</td>
                <td class="phone-number">${highlightText(member.contact || '연락처 정보 없음', searchQuery)}</td>
                <td class="home-icon">
                    ${member.homepage ? 
                        `<a href="${member.homepage}" target="_blank">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M10 20V14H14V20H19V12H22L12 3L2 12H5V20H10Z" fill="currentColor"/>
                            </svg>
                        </a>` : 
                        `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity: 0.3;">
                            <path d="M10 20V14H14V20H19V12H22L12 3L2 12H5V20H10Z" fill="currentColor"/>
                        </svg>`
                    }
                </td>
            </tr>
        `).join('');
        
        elements.memberTableBody.innerHTML = tableHTML;
        renderPagination();
        
        // 🔍 검색 결과 정보 표시
        if (searchQuery) {
            showSearchInfo();
        } else {
            hideSearchResults();
        }
    }

    // === 기존 함수들 (검색, 필터, 페이지네이션 등) 모두 유지 ===
    function renderPagination() {
        if (!elements.pagination) return;
        
        if (totalPages <= 1) {
            elements.pagination.innerHTML = '';
            return;
        }
        
        let paginationHTML = '';
        
        if (currentPage > 1) {
            paginationHTML += `<a href="#" class="prev-next" data-page="${currentPage - 1}">‹ 이전</a>`;
        }
        
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        
        if (startPage > 1) {
            paginationHTML += `<a href="#" data-page="1">1</a>`;
            if (startPage > 2) {
                paginationHTML += `<span class="ellipsis">...</span>`;
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === currentPage ? 'active' : '';
            paginationHTML += `<a href="#" class="${activeClass}" data-page="${i}">${i}</a>`;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += `<span class="ellipsis">...</span>`;
            }
            paginationHTML += `<a href="#" data-page="${totalPages}">${totalPages}</a>`;
        }
        
        if (currentPage < totalPages) {
            paginationHTML += `<a href="#" class="prev-next" data-page="${currentPage + 1}">다음 ›</a>`;
        }
        
        elements.pagination.innerHTML = paginationHTML;
        
        elements.pagination.querySelectorAll('a[data-page]').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const page = parseInt(this.dataset.page);
                if (page !== currentPage && page >= 1 && page <= totalPages) {
                    currentPage = page;
                    renderTable();
                }
            });
        });
    }

    // === 🔍 향상된 검색 설정 ===
    function setupSearch() {
        if (!elements.searchInput || !elements.searchButton) return;
        
        let searchTimeout;
        
        // 실시간 검색 (300ms 디바운스)
        elements.searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                performSearch(this.value);
            }, 300);
            
            // 🔍 클리어 버튼 표시/숨김
            if (elements.searchClearButton) {
                elements.searchClearButton.style.display = this.value ? 'block' : 'none';
            }
        });
        
        // 검색 버튼 클릭
        elements.searchButton.addEventListener('click', function() {
            performSearch(elements.searchInput.value);
        });
        
        // 엔터키 검색
        elements.searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(searchTimeout);
                performSearch(this.value);
            }
        });
        
        // 🔍 포커스 시 전체 선택
        elements.searchInput.addEventListener('focus', function() {
            this.select();
        });
        
        console.log('[RankMember] ✅ 향상된 검색 설정 완료');
    }

    // === 🔍 향상된 검색 실행 ===
    function performSearch(query) {
        const trimmedQuery = query.trim();
        
        // 검색어가 변경되지 않았으면 스킵
        if (searchQuery === trimmedQuery) {
            return;
        }
        
        console.log(`[RankMember] 🔍 향상된 검색 실행: "${trimmedQuery}"`);
        
        // 검색 히스토리 업데이트
        if (trimmedQuery && !searchState.searchHistory.includes(trimmedQuery)) {
            searchState.searchHistory.unshift(trimmedQuery);
            // 최대 10개까지만 보관
            searchState.searchHistory = searchState.searchHistory.slice(0, 10);
        }
        
        searchQuery = trimmedQuery;
        currentPage = 1;
        
        // 검색 상태 표시
        searchState.isSearching = true;
        
        try {
            applyCurrentFiltersAndSort();
            renderTable();
            
            // 검색 완료 후 정보 표시
            if (trimmedQuery) {
                showSearchInfo();
                console.log(`[RankMember] ✅ 검색 완료: ${filteredMembers.length}명 발견`);
            } else {
                hideSearchResults();
            }
            
        } catch (error) {
            console.error('[RankMember] ❌ 검색 실행 실패:', error);
            showNotification('검색 중 오류가 발생했습니다.', 'error');
        } finally {
            searchState.isSearching = false;
        }
    }

    function setupFilters() {
        if (!elements.filterButtons) return;
        
        elements.filterButtons.forEach(button => {
            button.addEventListener('click', function() {
                elements.filterButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                
                currentFilter = this.dataset.filter;
                currentPage = 1;
                
                applyCurrentFiltersAndSort();
                renderTable();
                
                console.log(`[RankMember] 📋 필터 적용: ${currentFilter}`);
            });
        });
    }

    function setupSorting() {
        if (!elements.settingsBtn || !elements.sortDropdown) return;
        
        elements.settingsBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            elements.sortDropdown.classList.toggle('active');
        });
        
        elements.sortDropdown.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', function() {
                elements.sortDropdown.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
                this.classList.add('active');
                
                currentSort = this.dataset.sort;
                
                applyCurrentFiltersAndSort();
                renderTable();
                
                elements.sortDropdown.classList.remove('active');
                
                console.log(`[RankMember] 🔄 정렬 변경: ${currentSort}`);
            });
        });
        
        document.addEventListener('click', function() {
            if (elements.sortDropdown) {
                elements.sortDropdown.classList.remove('active');
            }
        });
    }

    // === 🔄 WeightSync 호환 함수들 ===
    async function refreshMemberRankingData() {
        console.log('[RankMember] 🔄 의원 랭킹 데이터 새로고침...');
        try {
            await loadAllData();
            showNotification('의원 랭킹 데이터가 업데이트되었습니다.', 'success');
        } catch (error) {
            console.error('[RankMember] ❌ 새로고침 실패:', error);
            showNotification('데이터 새로고침에 실패했습니다.', 'error');
        }
    }

    // === 🚀 페이지 초기화 ===
    async function initializePage() {
        try {
            console.log('[RankMember] 🚀 클라이언트 가중치 연동 + 향상된 검색 의원 랭킹 페이지 초기화... (v3.3.0)');
            
            // 실시간 연동 시스템 먼저 초기화
            initializeRealTimeSync();
            
            // DOM 요소 초기화
            initializeElements();
            
            // 이벤트 리스너 설정
            setupSearch();
            setupFilters();
            setupSorting();
            
            // 데이터 로드
            await loadAllData();
            
            // 연결 상태 표시 업데이트
            updateConnectionStatus();
            
            initialized = true;
            console.log('[RankMember] ✅ 페이지 초기화 완료');
            
        } catch (error) {
            console.error('[RankMember] ❌ 페이지 초기화 실패:', error);
            hasError = true;
            showNotification('페이지 초기화에 실패했습니다.', 'error');
        }
    }

    // === 🔧 전역 함수 등록 ===
    window.refreshMemberRankingData = refreshMemberRankingData;
    window.refreshMemberDetails = refreshMemberRankingData;
    window.loadMemberData = loadAllData;
    window.clearSearch = clearSearch; // 전역 함수로 등록

    // === 🛠️ 디버그 함수들 (개선된 버전) ===
    window.memberRankingDebug = {
        getState: () => ({
            memberList,
            memberRanking,
            originalMemberData,
            filteredMembers,
            weightSyncState,
            searchState,
            currentSort,
            currentPage
        }),
        refreshData: () => refreshMemberRankingData(),
        recalculateScores: () => recalculateMemberScores(),
        getCurrentWeights: () => weightSyncState.currentWeights,
        getOriginalData: () => originalMemberData,
        
        // 🔍 검색 관련 디버그
        getSearchState: () => ({
            query: searchQuery,
            results: searchState.searchResults,
            history: searchState.searchHistory,
            isSearching: searchState.isSearching
        }),
        
        testSearch: (query) => {
            console.log(`[RankMember] 🔍 검색 테스트: "${query}"`);
            performSearch(query);
            return searchState.searchResults;
        },
        
        recreateChannel: () => {
            console.log('[RankMember] BroadcastChannel 재생성 시도...');
            const success = createBroadcastChannel();
            console.log('[RankMember] 재생성 결과:', success ? '성공' : '실패');
            return success;
        },
        
        getChannelStatus: () => {
            return {
                exists: !!weightSyncState.realTimeUpdateChannel,
                type: typeof weightSyncState.realTimeUpdateChannel,
                supported: typeof BroadcastChannel !== 'undefined'
            };
        },
        
        testBroadcast: (testData = { test: true, timestamp: new Date().toISOString() }) => {
            const success = safeBroadcast(testData);
            console.log('[RankMember] 테스트 브로드캐스트 결과:', success ? '성공' : '실패');
            return success;
        },
        
        showInfo: () => {
            console.log('[RankMember] 📊 페이지 정보 (v3.3.0 - 완전 통합 버전):');
            console.log(`- 전체 의원: ${memberList.length}명`);
            console.log(`- 원본 데이터: ${originalMemberData.length}명`);
            console.log(`- 필터된 의원: ${filteredMembers.length}명`);
            console.log(`- 현재 페이지: ${currentPage}/${totalPages}`);
            console.log(`- 현재 검색어: "${searchQuery}"`);
            console.log(`- 검색 결과:`, searchState.searchResults);
            console.log(`- APIService 상태: ${window.APIService?._isReady ? '✅' : '❌'}`);
            console.log(`- 가중치 연결: ${weightSyncState.percentPageConnected ? '✅' : '❌'}`);
            console.log(`- 현재 가중치:`, weightSyncState.currentWeights);
            console.log(`- 마지막 가중치 업데이트: ${weightSyncState.lastWeightUpdate || '없음'}`);
            const weightAppliedCount = filteredMembers.filter(m => m.weightApplied).length;
            console.log(`- 가중치 적용된 의원: ${weightAppliedCount}명`);
            console.log('- BroadcastChannel 상태:', this.getChannelStatus());
        },
        
        testWeightCalculation: (memberName) => {
            const member = originalMemberData.find(m => m.name === memberName);
            if (member && weightSyncState.currentWeights) {
                const bounds = calculateNormalizationBounds(originalMemberData);
                const score = calculateMemberScore(member, weightSyncState.currentWeights, bounds);
                console.log(`[RankMember] ${memberName} 점수 계산:`, score);
                return score;
            } else {
                console.log(`[RankMember] ${memberName} 찾을 수 없음 또는 가중치 없음`);
                return null;
            }
        }
    };

    // DOM 로드 완료 후 초기화
    let attempts = 0;
    const maxAttempts = 30;
    
    function waitForAPI() {
        attempts++;
        
        if (window.APIService && window.APIService._isReady) {
            console.log('[RankMember] ✅ API 서비스 연결 확인');
            initializePage();
        } else if (attempts < maxAttempts) {
            setTimeout(waitForAPI, 100);
        } else {
            console.warn('[RankMember] ⚠️ API 서비스 연결 타임아웃, 폴백 데이터 사용');
            memberList = getFallbackData();
            memberRanking = [];
            mergeAndProcessData();
            initializeElements();
            setupSearch();
            setupFilters();
            setupSorting();
            initializeRealTimeSync();
        }
    }
    
    waitForAPI();

    console.log('[RankMember] 📦 rank_member.js 로드 완료 (v3.3.0 - 완전 통합 버전 + BroadcastChannel v4)');
});
