/**
 * rank_member.js (v4.0.0) - API 계산 데이터 수신 의원 랭킹 시스템 (전체 의원)
 * 개선사항: percent.js에서 계산된 완성 데이터를 받아서 표시 (전체 299명)
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 API 계산 데이터 수신 의원 랭킹 페이지 로드 시작 (v4.0.0 - 전체 의원)');

    // === 📊 페이지 상태 관리 ===
    let memberList = [];
    let originalMemberData = [];  // API 원본 데이터
    let calculatedMemberData = []; // percent.js에서 계산된 데이터
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

    // 🔧 전체 의원 처리 (299명)
    console.log(`[RankMember] 📏 전체 의원 데이터 처리`);

    // 🎯 API 계산 데이터 수신 관련 상태
    let dataReceiveState = {
        isUsingCalculatedData: false,
        lastDataReceived: null,
        calculationTimestamp: null,
        percentPageConnected: false,
        realTimeUpdateChannel: null,
        appliedWeights: null
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

    // === 📡 안전한 BroadcastChannel 관리 ===
    function createBroadcastChannel() {
        if (typeof BroadcastChannel === 'undefined') {
            console.warn('[RankMember] ⚠️ BroadcastChannel을 지원하지 않는 브라우저입니다');
            return false;
        }

        try {
            // 기존 채널이 있으면 정리
            if (dataReceiveState.realTimeUpdateChannel) {
                try {
                    dataReceiveState.realTimeUpdateChannel.close();
                } catch (e) {
                    // 이미 닫혔을 수 있음
                }
            }

            // 🔧 통일된 채널명 사용 (v4)
            dataReceiveState.realTimeUpdateChannel = new BroadcastChannel('client_weight_updates_v4');
            
            dataReceiveState.realTimeUpdateChannel.addEventListener('message', async function(event) {
                try {
                    const data = event.data;
                    console.log('[RankMember] 📡 데이터 수신:', data.type);
                    
                    if (data.type === 'calculated_data_distribution' && data.source === 'percent_page') {
                        await handleCalculatedDataReceived(data);
                    } else if (data.type === 'data_reset_to_original' && data.source === 'percent_page') {
                        await handleDataResetRequest(data);
                    } else if (data.type === 'connection_check') {
                        // percent 페이지의 연결 확인 요청에 응답
                        safeBroadcast({
                            type: 'connection_response',
                            source: 'rank_member_page',
                            timestamp: new Date().toISOString(),
                            status: 'connected',
                            data_mode: dataReceiveState.isUsingCalculatedData ? 'calculated' : 'original',
                            member_limit: 'all'
                        });
                        dataReceiveState.percentPageConnected = true;
                        updateConnectionStatus();
                    }
                } catch (error) {
                    console.warn('[RankMember] 메시지 처리 실패:', error);
                }
            });

            // 채널 오류 처리
            dataReceiveState.realTimeUpdateChannel.addEventListener('error', function(error) {
                console.warn('[RankMember] BroadcastChannel 오류:', error);
                // 채널 재생성 시도
                setTimeout(createBroadcastChannel, 1000);
            });
            
            console.log('[RankMember] ✅ BroadcastChannel 초기화 완료 (v4)');
            return true;
            
        } catch (error) {
            console.error('[RankMember] BroadcastChannel 초기화 실패:', error);
            dataReceiveState.realTimeUpdateChannel = null;
            return false;
        }
    }

    // === 📡 안전한 브로드캐스트 함수 ===
    function safeBroadcast(data) {
        try {
            if (!dataReceiveState.realTimeUpdateChannel) {
                // 채널이 없으면 재생성 시도
                if (!createBroadcastChannel()) {
                    return false;
                }
            }

            dataReceiveState.realTimeUpdateChannel.postMessage(data);
            return true;
            
        } catch (error) {
            console.warn('[RankMember] 브로드캐스트 실패, 채널 재생성 시도:', error);
            
            // 채널 재생성 시도
            if (createBroadcastChannel()) {
                try {
                    dataReceiveState.realTimeUpdateChannel.postMessage(data);
                    return true;
                } catch (retryError) {
                    console.warn('[RankMember] 재시도 후에도 브로드캐스트 실패:', retryError);
                }
            }
            
            return false;
        }
    }

    // === 🔗 실시간 데이터 수신 시스템 초기화 ===
    function initializeRealTimeDataReceive() {
        console.log('[RankMember] 🔗 API 계산 데이터 수신 시스템 초기화...');
        
        try {
            // 1. BroadcastChannel 설정
            createBroadcastChannel();
            
            // localStorage 이벤트 감지
            window.addEventListener('storage', function(e) {
                if (e.key === 'calculated_data_distribution' && !isLoading) {
                    try {
                        // 🔧 null 체크 추가
                        if (!e.newValue || e.newValue === 'null') {
                            console.log('[RankMember] 📢 localStorage 데이터 삭제 감지 (무시)');
                            return;
                        }
                        
                        const eventData = JSON.parse(e.newValue);
                        
                        // 🔧 데이터 유효성 검증
                        if (!eventData || !eventData.type) {
                            console.warn('[RankMember] 📢 유효하지 않은 데이터 (무시)');
                            return;
                        }
                        
                        console.log('[RankMember] 📢 localStorage 계산 데이터 변경 감지:', eventData.type);
                        
                        if (eventData.type === 'calculated_data_distribution') {
                            handleCalculatedDataReceived(eventData);
                        } else if (eventData.type === 'data_reset_to_original') {
                            handleDataResetRequest(eventData);
                        }
                    } catch (error) {
                        console.warn('[RankMember] localStorage 이벤트 파싱 실패:', error);
                    }
                }
            });
            
            console.log('[RankMember] ✅ 실시간 데이터 수신 시스템 초기화 완료');
            
        } catch (error) {
            console.error('[RankMember] 실시간 데이터 수신 시스템 초기화 실패:', error);
        }
    }

    // === 🎯 핵심: percent.js에서 계산된 데이터 수신 처리 ===
    async function handleCalculatedDataReceived(eventData) {
        if (isLoading) {
            console.log('[RankMember] 🔄 이미 처리 중입니다.');
            return;
        }

        try {
            isLoading = true;
            
            console.log('[RankMember] 🎯 계산된 의원 데이터 수신 처리 시작...');
            
            // 🔍 현재 검색 상태 저장
            const currentSearchState = {
                query: searchQuery,
                filter: currentFilter,
                sort: currentSort,
                page: currentPage
            };
            
            // 사용자에게 알림
            showDataUpdateNotification(`percent.js에서 계산된 의원 데이터를 적용하는 중... (전체 의원)`, 'info', 3000);
            
            // 로딩 상태 표시
            setLoadingState(true, `API 계산 데이터로 순위 업데이트 중... (전체 의원)`);
            
            // 🎯 계산된 의원 데이터 적용 (전체)
            if (eventData.memberData && eventData.memberData.full_list) {
                // 🔧 전체 의원 데이터 사용
                const fullMemberData = eventData.memberData.full_list;
                
                calculatedMemberData = fullMemberData.map((member, index) => {
                    // 🔍 실제 의원 데이터와 병합
                    const originalMember = originalMemberData.find(m => m.name === member.name);
                    
                    return {
                        rank: index + 1,
                        name: member.name,
                        party: member.party,
                        
                        // 🎯 실제 연락처 정보 사용
                        contact: originalMember ? originalMember.contact : '연락처 정보 없음',
                        homepage: originalMember ? originalMember.homepage : '',
                        
                        // 계산된 점수 정보
                        calculatedScore: member.calculated_score,
                        originalScore: member.original_score,
                        scoreChanged: member.score_changed,
                        scoreSource: 'api_calculated',
                        lastUpdated: member.calculation_timestamp,
                        weightApplied: member.weight_applied,
                        
                        // 메타데이터
                        _isCalculated: true,
                        _calculationMethod: 'api_weighted',
                        _originalMember: originalMember // 원본 참조 유지
                    };
                });

                
                // 🎯 상태 업데이트
                dataReceiveState.isUsingCalculatedData = true;
                dataReceiveState.lastDataReceived = new Date(eventData.timestamp);
                dataReceiveState.calculationTimestamp = eventData.timestamp;
                dataReceiveState.appliedWeights = eventData.appliedWeights;
                
                // 현재 데이터를 계산된 데이터로 교체
                filteredMembers = [...calculatedMemberData];
                
                console.log(`[RankMember] ✅ 계산된 의원 데이터 적용 완료: ${calculatedMemberData.length}명 (전체 의원)`);
            } else {
                throw new Error('유효한 의원 계산 데이터가 없습니다');
            }
            
            // 🔍 검색 상태 복원
            await restoreSearchState(currentSearchState);
            
            // 연결 상태 업데이트
            dataReceiveState.percentPageConnected = true;
            updateConnectionStatus();
            
            // 성공 알림
            const weightCount = eventData.appliedWeights ? Object.keys(eventData.appliedWeights).length : 0;
            showDataUpdateNotification(
                `✅ API 계산 데이터 적용 완료! ${calculatedMemberData.length}명 (${weightCount}개 가중치)`, 
                'success', 
                4000
            );
            
            console.log('[RankMember] ✅ 계산된 데이터 수신 처리 완료');
            
        } catch (error) {
            console.error('[RankMember] ❌ 계산된 데이터 수신 처리 실패:', error);
            showDataUpdateNotification(`데이터 수신 실패: ${error.message}`, 'error', 5000);
        } finally {
            isLoading = false;
            setLoadingState(false);
        }
    }

    // === 🔄 데이터 리셋 요청 처리 ===
    async function handleDataResetRequest(eventData) {
        try {
            console.log('[RankMember] 🔄 데이터 리셋 요청 수신:', eventData.action);
            
            showDataUpdateNotification('원본 데이터로 복원하는 중...', 'info', 2000);
            
            // 계산된 데이터 상태 해제
            dataReceiveState.isUsingCalculatedData = false;
            dataReceiveState.lastDataReceived = null;
            dataReceiveState.calculationTimestamp = null;
            dataReceiveState.appliedWeights = null;
            calculatedMemberData = [];
            
            // 원본 데이터로 복원
            if (originalMemberData.length > 0) {
                filteredMembers = [...originalMemberData];
                applyCurrentFiltersAndSort();
                renderTable();
                renderPagination();
            } else {
                // 원본 데이터가 없으면 API에서 다시 로드
                await loadAllData();
            }
            
            updateConnectionStatus();
            showDataUpdateNotification('✅ 원본 API 데이터로 복원되었습니다!', 'success', 3000);
            
        } catch (error) {
            console.error('[RankMember] ❌ 데이터 리셋 실패:', error);
            showDataUpdateNotification('원본 데이터 복원에 실패했습니다', 'error');
        }
    }

    // === 📊 데이터 업데이트 정보 표시 ===
    function showCalculatedDataInfo() {
        try {
            let infoElement = document.getElementById('member-calculated-data-info');
            if (!infoElement) {
                infoElement = document.createElement('div');
                infoElement.id = 'member-calculated-data-info';
                infoElement.style.cssText = `
                    margin: 10px 0; padding: 12px 18px; 
                    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
                    color: white; border-radius: 10px; font-size: 14px; text-align: center;
                    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.25); 
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
            
            const weightInfo = dataReceiveState.appliedWeights ? 
                `(${Object.keys(dataReceiveState.appliedWeights).length}개 가중치 적용)` : '';
            
            const searchInfo = searchQuery ? 
                ` | 검색: "${searchQuery}"` : '';
            
            const timeInfo = dataReceiveState.calculationTimestamp ? 
                new Date(dataReceiveState.calculationTimestamp).toLocaleTimeString('ko-KR') : 
                new Date().toLocaleTimeString('ko-KR');
            
            infoElement.innerHTML = `
                <div style="display: flex; justify-content: center; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <span style="font-size: 18px;">📡</span>
                    <span><strong>${calculatedMemberData.length}명</strong>의 의원이 API 계산 데이터로 업데이트되었습니다! ${weightInfo}${searchInfo}</span>
                    <span style="font-size: 11px; opacity: 0.9;">${timeInfo}</span>
                </div>
            `;
            
            // 애니메이션 스타일 추가
            if (!document.getElementById('member-calculated-data-styles')) {
                const style = document.createElement('style');
                style.id = 'member-calculated-data-styles';
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
            console.warn('[RankMember] 계산 데이터 정보 표시 실패:', error);
        }
    }

    // === 🔔 데이터 업데이트 전용 알림 시스템 ===
    function showDataUpdateNotification(message, type = 'info', duration = 4000) {
        try {
            // 기존 알림 제거
            const existingNotification = document.querySelector('.member-data-update-notification');
            if (existingNotification) {
                existingNotification.remove();
            }
            
            const notification = document.createElement('div');
            notification.className = 'member-data-update-notification';
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
                           'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'};
                color: white;
            `;
            
            notification.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                    <span style="font-size: 16px;">${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '📡'}</span>
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
            console.log(`[RankMember 데이터 알림] ${message} (${type})`);
        }
    }

    // === 🎨 연결 상태 표시 업데이트 ===
    function updateConnectionStatus() {
        try {
            let statusElement = document.getElementById('member-data-sync-status');
            if (!statusElement) {
                statusElement = document.createElement('div');
                statusElement.id = 'member-data-sync-status';
                statusElement.style.cssText = `
                    position: fixed; top: 10px; right: 10px; z-index: 1000;
                    padding: 8px 12px; color: white; border-radius: 20px; 
                    font-size: 11px; font-weight: 500; backdrop-filter: blur(4px);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: all 0.3s ease; 
                    font-family: 'Blinker', sans-serif;
                `;
                document.body.appendChild(statusElement);
            }
            
            if (dataReceiveState.isUsingCalculatedData && dataReceiveState.percentPageConnected) {
                statusElement.style.background = 'rgba(139, 92, 246, 0.9)';
                statusElement.innerHTML = `📡 API 계산 데이터 (전체)`;
            } else if (dataReceiveState.percentPageConnected) {
                statusElement.style.background = 'rgba(16, 185, 129, 0.9)';
                statusElement.innerHTML = '🔗 percent 페이지 연결됨';
            } else if (originalMemberData.length > 0) {
                statusElement.style.background = 'rgba(59, 130, 246, 0.9)';
                statusElement.innerHTML = `📊 원본 API 데이터 (전체)`;
            } else {
                statusElement.style.background = 'rgba(107, 114, 128, 0.9)';
                statusElement.innerHTML = '📴 기본 데이터';
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

    // 로딩 상태 관리
    function setLoadingState(loading, message = '의원 데이터를 처리하는 중...') {
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

    // === 🚀 기존 API 데이터 로드 함수 (원본 데이터용) ===
    async function loadAllData() {
        try {
            setLoadingState(true);
            console.log(`[RankMember] 🚀 원본 API 데이터 로드 시작... (전체 의원)`);
            
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
                // 🔧 전체 의원 목록 사용
                memberList = membersResult.value || [];
                console.log(`[RankMember] ✅ 국회의원 명단: ${memberList.length}명`);
            } else {
                console.error('[RankMember] ❌ 국회의원 명단 로드 실패:', membersResult.reason);
                throw new Error('국회의원 명단을 불러올 수 없습니다.');
            }
            
            let memberRanking = [];
            if (rankingResult.status === 'fulfilled') {
                // 🔧 전체 랭킹 데이터 사용
                memberRanking = rankingResult.value || [];
                console.log(`[RankMember] ✅ 랭킹 데이터: ${memberRanking.length}개`);
            } else {
                console.warn('[RankMember] ⚠️ 랭킹 데이터 로드 실패:', rankingResult.reason);
            }

            // 🔧 성과 데이터 로드 - 전체 버전
            let memberPerformanceData = [];
            if (performanceResult.status === 'fulfilled') {
                const rawPerformanceData = performanceResult.value;
                
                // 📊 데이터 구조 확인 및 정규화
                if (Array.isArray(rawPerformanceData)) {
                    memberPerformanceData = rawPerformanceData;
                } else if (rawPerformanceData && typeof rawPerformanceData === 'object') {
                    // 객체 형태로 반환된 경우 (예: {ranking: [...], data: [...]} 등)
                    if (rawPerformanceData.ranking && Array.isArray(rawPerformanceData.ranking)) {
                        memberPerformanceData = rawPerformanceData.ranking;
                    } else if (rawPerformanceData.data && Array.isArray(rawPerformanceData.data)) {
                        memberPerformanceData = rawPerformanceData.data;
                    } else if (rawPerformanceData.results && Array.isArray(rawPerformanceData.results)) {
                        memberPerformanceData = rawPerformanceData.results;
                    } else {
                        // 객체의 모든 값 중 배열인 것을 찾아서 사용
                        const arrayValues = Object.values(rawPerformanceData).filter(val => Array.isArray(val));
                        if (arrayValues.length > 0) {
                            memberPerformanceData = arrayValues[0];
                        } else {
                            console.warn('[RankMember] ⚠️ 성과 데이터에서 배열을 찾을 수 없습니다:', rawPerformanceData);
                            memberPerformanceData = [];
                        }
                    }
                } else {
                    console.warn('[RankMember] ⚠️ 예상하지 못한 성과 데이터 형태:', rawPerformanceData);
                    memberPerformanceData = [];
                }
                
                console.log(`[RankMember] ✅ 성과 데이터: ${memberPerformanceData.length}개`);
                
                // 🔍 데이터 구조 확인 로깅
                if (memberPerformanceData.length > 0) {
                    console.log('[RankMember] 📋 성과 데이터 샘플:', memberPerformanceData[0]);
                }
                
            } else {
                console.warn('[RankMember] ⚠️ 성과 데이터 로드 실패:', performanceResult.reason);
                memberPerformanceData = [];
            }
            
            // 🎯 원본 데이터 병합 및 보관 (전체)
            mergeAndStoreOriginalData(memberRanking, memberPerformanceData);
            
            // 계산된 데이터가 있으면 그것을 사용, 없으면 원본 데이터 사용
            if (dataReceiveState.isUsingCalculatedData && calculatedMemberData.length > 0) {
                filteredMembers = [...calculatedMemberData];
            } else {
                filteredMembers = [...originalMemberData];
            }
            
            applyCurrentFiltersAndSort();
            renderTable();
            renderPagination();
            
            console.log(`[RankMember] ✅ 원본 API 데이터 로드 완료 (${originalMemberData.length}명)`);
            return true;
            
        } catch (error) {
            console.error('[RankMember] ❌ 데이터 로드 실패:', error);
            hasError = true;
            showNotification('데이터 로드에 실패했습니다.', 'error');
            
            memberList = getFallbackData();
            mergeAndStoreOriginalData([], []);
            
            throw error;
        } finally {
            setLoadingState(false);
        }
    }

    // === 🎯 원본 데이터 병합 및 저장 ===
    function mergeAndStoreOriginalData(memberRanking, performanceData) {
        try {
            console.log(`[RankMember] 📊 원본 데이터 병합 중... (전체 의원)`);
            
            // 🔧 데이터 유효성 검증
            const validMemberRanking = Array.isArray(memberRanking) ? memberRanking : [];
            const validPerformanceData = Array.isArray(performanceData) ? performanceData : [];
            
            console.log(`[RankMember] 📋 병합 대상 - 랭킹: ${validMemberRanking.length}개, 성과: ${validPerformanceData.length}개`);
            
            originalMemberData = memberList.map((member, index) => {
                const memberName = member.name || '';
                
                // 🔍 랭킹 데이터 검색 (방어적 프로그래밍)
                let ranking = null;
                try {
                    ranking = validMemberRanking.find(r => r && r.HG_NM === memberName);
                } catch (error) {
                    console.warn(`[RankMember] 랭킹 데이터 검색 실패 (${memberName}):`, error);
                }
                
                // 🔍 성과 데이터 검색 (방어적 프로그래밍)
                let performance = null;
                try {
                    performance = validPerformanceData.find(p => {
                        // 다양한 필드명 대응
                        return p && (
                            p.lawmaker_name === memberName ||
                            p.name === memberName ||
                            p.member_name === memberName ||
                            p.HG_NM === memberName
                        );
                    });
                } catch (error) {
                    console.warn(`[RankMember] 성과 데이터 검색 실패 (${memberName}):`, error);
                }
                
                return {
                    // 기본 정보
                    rank: ranking ? parseInt(ranking.총점_순위) || (index + 1) : (index + 1),
                    name: memberName,
                    party: member.party || '정당 정보 없음',
                    contact: member.phone || '',
                    homepage: member.homepage || '',
                    originalIndex: index,
                    
                    // 원본 점수 정보
                    originalScore: ranking ? parseFloat(ranking.총점 || 0) : 0,
                    scoreSource: 'api_original',
                    
                    // 성과 데이터 추가 정보 (있는 경우)
                    performanceScore: performance ? parseFloat(performance.total_score || performance.총점 || 0) : null,
                    attendanceScore: performance ? parseFloat(performance.attendance_score || 0) : null,
                    
                    // 원본 데이터 참조
                    _member: member,
                    _ranking: ranking,
                    _performance: performance
                };
            });
            
            console.log(`[RankMember] ✅ 원본 데이터 병합 완료: ${originalMemberData.length}명`);
            
            // 🔍 병합된 데이터 품질 확인
            const withRanking = originalMemberData.filter(m => m._ranking).length;
            const withPerformance = originalMemberData.filter(m => m._performance).length;
            
            console.log(`[RankMember] 📊 데이터 품질 - 랭킹 연결: ${withRanking}명, 성과 연결: ${withPerformance}명`);
            
        } catch (error) {
            console.error('[RankMember] ❌ 원본 데이터 병합 실패:', error);
            
            // 📋 최소한의 기본 데이터라도 생성
            originalMemberData = memberList.map((member, index) => ({
                rank: index + 1,
                name: member.name || '',
                party: member.party || '정당 정보 없음',
                contact: member.phone || '',
                homepage: member.homepage || '',
                originalIndex: index,
                originalScore: 0,
                scoreSource: 'fallback',
                _member: member,
                _ranking: null,
                _performance: null
            }));
            
            console.log(`[RankMember] 🔧 폴백 데이터 생성: ${originalMemberData.length}명`);
        }
    }

    // === 🔧 API 데이터 구조 디버깅 함수 추가 ===
    function debugApiDataStructure() {
        console.log(`[RankMember] 🔍 API 데이터 구조 디버깅 (전체 의원):`);
        
        if (memberList.length > 0) {
            console.log('👥 memberList 샘플:', memberList[0]);
        }
        
        if (originalMemberData.length > 0) {
            console.log('📊 originalMemberData 샘플:', originalMemberData[0]);
        }
        
        console.log('📈 데이터 상태:', {
            memberList: memberList.length,
            originalMemberData: originalMemberData.length,
            calculatedMemberData: calculatedMemberData.length,
            filteredMembers: filteredMembers.length
        });
    }

    // 디버그 함수를 전역으로 등록
    window.debugRankMemberData = debugApiDataStructure;

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
            
            // 계산된 데이터 정보 표시
            if (dataReceiveState.isUsingCalculatedData) {
                showCalculatedDataInfo();
            }
            
            console.log('[RankMember] ✅ 검색 상태 복원 완료');
            
        } catch (error) {
            console.error('[RankMember] ❌ 검색 상태 복원 실패:', error);
        }
    }

    // === 🔄 필터 및 정렬 적용 (향상된 검색 포함) ===
    function applyCurrentFiltersAndSort() {
        // 현재 사용할 데이터 결정 (계산된 데이터 우선)
        let workingData = [];
        
        if (dataReceiveState.isUsingCalculatedData && calculatedMemberData.length > 0) {
            workingData = [...calculatedMemberData];
        } else if (originalMemberData.length > 0) {
            workingData = [...originalMemberData];
        } else {
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

    // === 기존 함수들 계속 유지 (렌더링, 페이지네이션, 검색 등) ===
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
                    ${member.scoreSource === 'api_calculated' ? 
                        '<span style="color: #8b5cf6; font-size: 10px; margin-left: 5px;" title="API 계산 데이터">📡</span>' : 
                        member.scoreSource === 'api_original' ? 
                        '<span style="color: #3b82f6; font-size: 10px; margin-left: 5px;" title="원본 API 데이터">📊</span>' : ''
                    }
                </td>
                <td>
                    <a href="percent_member.html?member=${encodeURIComponent(member.name)}" 
                       class="member-name">${highlightText(member.name, searchQuery)}</a>
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

    // === 기존 함수들 모두 유지 (검색, 페이지네이션, 필터링 등) ===
    
    // 폴백 데이터 (전체)
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
        ]; // 폴백 데이터는 전체 처리
    }

    // === 🔍 검색 관련 함수들 ===
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
                        ${dataReceiveState.isUsingCalculatedData ? '📡 계산 데이터' : '📊 원본 데이터'} | ${new Date().toLocaleTimeString('ko-KR')}
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

    function hideSearchResults() {
        try {
            if (elements.searchResults) {
                elements.searchResults.style.display = 'none';
            }
        } catch (error) {
            console.warn('[RankMember] 검색 결과 정보 숨김 실패:', error);
        }
    }

    // === 기존 함수들 모두 유지 (페이지네이션, 필터, 정렬 등) ===
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

    // === 🔄 호환 함수들 ===
    async function refreshMemberRankingData() {
        console.log(`[RankMember] 🔄 의원 랭킹 데이터 새로고침... (전체 의원)`);
        try {
            await loadAllData();
            showNotification(`의원 랭킹 데이터가 업데이트되었습니다. (${originalMemberData.length}명)`, 'success');
        } catch (error) {
            console.error('[RankMember] ❌ 새로고침 실패:', error);
            showNotification('데이터 새로고침에 실패했습니다.', 'error');
        }
    }

    // === 🚀 페이지 초기화 ===
    async function initializePage() {
        try {
            console.log(`[RankMember] 🚀 API 계산 데이터 수신 의원 랭킹 페이지 초기화... (v4.0.0 - 전체 의원)`);
            
            // 실시간 데이터 수신 시스템 먼저 초기화
            initializeRealTimeDataReceive();
            
            // DOM 요소 초기화
            initializeElements();
            
            // 이벤트 리스너 설정
            setupSearch();
            setupFilters();
            setupSorting();
            
            // 원본 데이터 로드
            await loadAllData();
            
            // 연결 상태 표시 업데이트
            updateConnectionStatus();
            
            initialized = true;
            console.log(`[RankMember] ✅ 페이지 초기화 완료 (전체 의원)`);
            
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
    window.clearSearch = clearSearch;

    // === 🛠️ 디버그 함수들 ===
    window.memberRankingDebug = {
        getState: () => ({
            memberList,
            originalMemberData,
            calculatedMemberData,
            filteredMembers,
            dataReceiveState,
            searchState,
            currentSort,
            currentPage
        }),
        refreshData: () => refreshMemberRankingData(),
        
        // 데이터 수신 관련
        getDataReceiveState: () => dataReceiveState,
        getOriginalData: () => originalMemberData,
        getCalculatedData: () => calculatedMemberData,
        getCurrentData: () => filteredMembers,
        
        // 연결 관련
        recreateChannel: () => {
            console.log('[RankMember] BroadcastChannel 재생성 시도...');
            const success = createBroadcastChannel();
            console.log('[RankMember] 재생성 결과:', success ? '성공' : '실패');
            return success;
        },
        
        getChannelStatus: () => {
            return {
                exists: !!dataReceiveState.realTimeUpdateChannel,
                type: typeof dataReceiveState.realTimeUpdateChannel,
                supported: typeof BroadcastChannel !== 'undefined'
            };
        },
        
        testBroadcast: (testData = { test: true, timestamp: new Date().toISOString() }) => {
            const success = safeBroadcast(testData);
            console.log('[RankMember] 테스트 브로드캐스트 결과:', success ? '성공' : '실패');
            return success;
        },
        
        // 검색 관련
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
        
        showInfo: () => {
            console.log('[RankMember] 📊 페이지 정보 (v4.0.0 - API 계산 데이터 수신):');
            console.log(`- 전체 의원: ${memberList.length}명`);
            console.log(`- 원본 데이터: ${originalMemberData.length}명`);
            console.log(`- 계산된 데이터: ${calculatedMemberData.length}명`);
            console.log(`- 필터된 의원: ${filteredMembers.length}명`);
            console.log(`- 현재 페이지: ${currentPage}/${totalPages}`);
            console.log(`- 현재 검색어: "${searchQuery}"`);
            console.log(`- 검색 결과:`, searchState.searchResults);
            console.log(`- APIService 상태: ${window.APIService?._isReady ? '✅' : '❌'}`);
            console.log(`- percent 페이지 연결: ${dataReceiveState.percentPageConnected ? '✅' : '❌'}`);
            console.log(`- 계산된 데이터 사용: ${dataReceiveState.isUsingCalculatedData ? '✅' : '❌'}`);
            console.log(`- 마지막 데이터 수신: ${dataReceiveState.lastDataReceived || '없음'}`);
            console.log(`- 적용된 가중치:`, dataReceiveState.appliedWeights);
            console.log('- BroadcastChannel 상태:', this.getChannelStatus());
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
            mergeAndStoreOriginalData([], []);
            filteredMembers = [...originalMemberData];
            initializeElements();
            setupSearch();
            setupFilters();
            setupSorting();
            initializeRealTimeDataReceive();
        }
    }
    
    waitForAPI();

    console.log('[RankMember] 📦 rank_member.js 로드 완료 (v4.0.0 - API 계산 데이터 수신)');
});