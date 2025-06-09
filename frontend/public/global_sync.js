/**
 * 백일하(Baek-il-ha) - Updated API Service
 */

(function() {
    'use strict';

    if (typeof window.APIService === 'undefined') {
        window.APIService = {
            showNotification: function(message, type = 'info') {
                console.log(`[알림] ${message} (${type})`);
            },
            getEnvironmentInfo: function() {
                return {
                    isVercel: window.location.hostname.includes('vercel'),
                    isLocal: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                };
            },
            _isReady: false,
            _hasError: false
        };
    }

    const API_CONFIG = {
        BASE_URL: 'https://baekilha.onrender.com',
        ENDPOINTS: {
            // === 청원 관련 ===
            PETITION: '/legislation/petition/',
            PETITION_INTRODUCER: '/legislation/petition-introducer/',
            
            // === 본회의 관련 ===
            LEGISLATION_ALL: '/legislation/all/',
            LEGISLATION_COSTLY: '/legislation/costly/',
            LEGISLATION_COST: '/legislation/cost/',
            LEGISLATION_ETC: '/legislation/etc/',
            LEGISLATION_LAW: '/legislation/law/',
            LEGISLATION_BILL: '/legislation/bill/',
            
            // === 위원회 관련 ===
            COMMITTEE_MEMBER: '/legislation/committee-member/',
            
            // === 국회의원 관련 ===
            MEMBER: '/legislation/member/',
            MEMBER_PERFORMANCE: '/performance/api/performance/',
            MEMBER_ATTENDANCE: '/attendance/attendance/',
            MEMBER_BILL_COUNT: '/legislation/bill-count/',
            MEMBER_RANKING: '/ranking/members/',
            MEMBER_PHOTO: '/legislation/photo/',
            
            // === 정당 관련 ===
            PARTY_PERFORMANCE: '/performance/api/party_performance/',
            PARTY_RANKING_SCORE: '/ranking/parties/score/',
            PARTY_RANKING_STATS: '/ranking/parties/stats/',
            PARTY_MEMBER_PERFORMANCE: '/performance/api/performance/by-party/',
            
            // === 비교 기능 ===
            COMPARE_MEMBERS: '/compare_members/',
            COMPARE_PARTIES: '/compare_parties/',
            
            // === 챗봇 ===
            CHATBOT: '/chatbot/ask/',
            
            // === 설정 ===
            UPDATE_WEIGHTS: '/performance/api/update_weights/',
            
            // === 기타 ===
            PARTY_STATS: '/performance/api/party_stats/'
        },
        TIMEOUT: 15000,
        MAX_RETRIES: 3
    };

    const VALID_PARTIES = [
        '더불어민주당', '국민의힘', '조국혁신당', '진보당',
        '개혁신당', '사회민주당', '기본소득당', '무소속'
    ];

    const DEBUG_MODE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // === 🔧 유틸리티 함수들 ===
    function log(level, message, data = null) {
        if (!DEBUG_MODE && level === 'debug') return;
        
        try {
            const timestamp = new Date().toLocaleTimeString('ko-KR');
            const emoji = { debug: '🔧', info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };
            const logMethod = level === 'error' ? 'error' : 'log';
            console[logMethod](`${emoji[level]} [${timestamp}] ${message}`, data || '');
        } catch (e) {
            console.log(`[LOG ERROR] ${message}`);
        }
    }

    function checkNetworkStatus() {
        try {
            return navigator.onLine !== false;
        } catch (e) {
            return true;
        }
    }

    async function makeRequest(url, options = {}) {
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: API_CONFIG.TIMEOUT
        };

        const finalOptions = { ...defaultOptions, ...options };
        log('debug', `API 요청: ${url}`);

        if (!checkNetworkStatus()) {
            throw new Error('네트워크 연결이 없습니다');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), finalOptions.timeout);

        try {
            const response = await fetch(url, {
                ...finalOptions,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            log('success', `API 성공: ${url.split('/').pop()}`);
            return data;

        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error(`요청 시간 초과 (${finalOptions.timeout}ms)`);
            }
            
            log('error', `API 실패: ${url.split('/').pop()}`, error.message);
            throw error;
        }
    }

    async function apiCallWithRetry(url, options = {}) {
        let lastError;
        
        for (let attempt = 1; attempt <= API_CONFIG.MAX_RETRIES; attempt++) {
            try {
                return await makeRequest(url, options);
            } catch (error) {
                lastError = error;
                
                if (attempt < API_CONFIG.MAX_RETRIES) {
                    const delay = attempt * 1000;
                    log('warning', `재시도 ${attempt}/${API_CONFIG.MAX_RETRIES} (${delay}ms 후)`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw lastError;
    }

    function validatePartyName(partyName) {
        if (!partyName || typeof partyName !== 'string') return false;
        return VALID_PARTIES.includes(partyName.trim());
    }

    function showNotification(message, type = 'info', duration = 3000) {
        try {
            const existing = document.querySelector('.api-notification');
            if (existing) existing.remove();

            const notification = document.createElement('div');
            notification.className = `api-notification ${type}`;
            notification.textContent = message;

            const styles = {
                position: 'fixed', top: '20px', right: '20px', padding: '12px 20px',
                borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: '10000', fontSize: '13px', maxWidth: '350px',
                fontFamily: 'Blinker, sans-serif', transition: 'all 0.3s ease',
                opacity: '0', transform: 'translateX(100%)'
            };

            Object.assign(notification.style, styles);

            const colors = {
                success: { backgroundColor: '#4caf50', color: 'white' },
                error: { backgroundColor: '#f44336', color: 'white' },
                warning: { backgroundColor: '#ff9800', color: 'white' },
                info: { backgroundColor: '#2196f3', color: 'white' }
            };

            Object.assign(notification.style, colors[type] || colors.info);
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

        } catch (error) {
            console.log(`[알림] ${message} (${type})`);
        }
    }

    function createAPIService() {
        try {
            return {
                showNotification,
                
                getEnvironmentInfo() {
                    try {
                        return {
                            isVercel: window.location.hostname.includes('vercel'),
                            isLocal: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
                            hostname: window.location.hostname,
                            timestamp: new Date().toISOString()
                        };
                    } catch (e) {
                        return { isVercel: false, isLocal: true, error: e.message };
                    }
                },

                // === 📄 청원 관련 API ===
                async getPetitions() {
                    try {
                        const url = API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.PETITION;
                        log('debug', '청원 데이터 조회 시작');
                        const rawData = await apiCallWithRetry(url);
                        log('success', `청원 데이터 조회 완료`);
                        return rawData;
                    } catch (error) {
                        log('error', '청원 데이터 조회 실패:', error.message);
                        throw new Error(`청원 데이터를 가져올 수 없습니다: ${error.message}`);
                    }
                },

                async getPetitionIntroducers() {
                    try {
                        const url = API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.PETITION_INTRODUCER;
                        log('debug', '청원 소개의원 데이터 조회 시작');
                        const rawData = await apiCallWithRetry(url);
                        log('success', `청원 소개의원 데이터 조회 완료`);
                        return rawData;
                    } catch (error) {
                        log('error', '청원 소개의원 데이터 조회 실패:', error.message);
                        throw new Error(`청원 소개의원 데이터를 가져올 수 없습니다: ${error.message}`);
                    }
                },

                // === 🏛️ 본회의 관련 API ===
                async getAllLegislation() {
                    try {
                        const url = API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.LEGISLATION_ALL;
                        log('debug', '전체 본회의 데이터 조회 시작');
                        const rawData = await apiCallWithRetry(url);
                        log('success', `전체 본회의 데이터 조회 완료: ${rawData?.length || 0}건`);
                        return rawData;
                    } catch (error) {
                        log('error', '전체 본회의 데이터 조회 실패:', error.message);
                        throw new Error(`전체 본회의 데이터를 가져올 수 없습니다: ${error.message}`);
                    }
                },

                async getCostlyLegislation() {
                    try {
                        const url = API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.LEGISLATION_COSTLY;
                        log('debug', '예산안 데이터 조회 시작');
                        const rawData = await apiCallWithRetry(url);
                        log('success', `예산안 데이터 조회 완료: ${rawData?.length || 0}건`);
                        return rawData;
                    } catch (error) {
                        log('error', '예산안 데이터 조회 실패:', error.message);
                        throw new Error(`예산안 데이터를 가져올 수 없습니다: ${error.message}`);
                    }
                },

                async getCostLegislation() {
                    try {
                        const url = API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.LEGISLATION_COST;
                        log('debug', '결산안 데이터 조회 시작');
                        const rawData = await apiCallWithRetry(url);
                        log('success', `결산안 데이터 조회 완료: ${rawData?.length || 0}건`);
                        return rawData;
                    } catch (error) {
                        log('error', '결산안 데이터 조회 실패:', error.message);
                        throw new Error(`결산안 데이터를 가져올 수 없습니다: ${error.message}`);
                    }
                },

                async getEtcLegislation() {
                    try {
                        const url = API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.LEGISLATION_ETC;
                        log('debug', '기타 본회의 데이터 조회 시작');
                        const rawData = await apiCallWithRetry(url);
                        log('success', `기타 본회의 데이터 조회 완료: ${rawData?.length || 0}건`);
                        return rawData;
                    } catch (error) {
                        log('error', '기타 본회의 데이터 조회 실패:', error.message);
                        throw new Error(`기타 본회의 데이터를 가져올 수 없습니다: ${error.message}`);
                    }
                },

                async getLawLegislation() {
                    try {
                        const url = API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.LEGISLATION_LAW;
                        log('debug', '법률안 데이터 조회 시작');
                        const rawData = await apiCallWithRetry(url);
                        log('success', `법률안 데이터 조회 완료: ${rawData?.length || 0}건`);
                        return rawData;
                    } catch (error) {
                        log('error', '법률안 데이터 조회 실패:', error.message);
                        throw new Error(`법률안 데이터를 가져올 수 없습니다: ${error.message}`);
                    }
                },

                async getBillLegislation() {
                    try {
                        const url = API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.LEGISLATION_BILL;
                        log('debug', '발의 법률안 데이터 조회 시작');
                        const rawData = await apiCallWithRetry(url);
                        log('success', `발의 법률안 데이터 조회 완료: ${rawData?.length || 0}건`);
                        return rawData;
                    } catch (error) {
                        log('error', '발의 법률안 데이터 조회 실패:', error.message);
                        throw new Error(`발의 법률안 데이터를 가져올 수 없습니다: ${error.message}`);
                    }
                },

                // === 👥 위원회 관련 API ===
                async getCommitteeMembers() {
                    try {
                        const url = API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.COMMITTEE_MEMBER;
                        log('debug', '위원회 구성원 데이터 조회 시작');
                        const rawData = await apiCallWithRetry(url);
                        log('success', `위원회 구성원 데이터 조회 완료`);
                        return rawData;
                    } catch (error) {
                        log('error', '위원회 구성원 데이터 조회 실패:', error.message);
                        throw new Error(`위원회 구성원 데이터를 가져올 수 없습니다: ${error.message}`);
                    }
                },

                // === 👤 국회의원 관련 API ===
                async getAllMembers() {
                    try {
                        const url = API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.MEMBER;
                        log('debug', '국회의원 명단 조회 시작');
                        const rawData = await apiCallWithRetry(url);
                        log('success', `국회의원 명단 조회 완료`);
                        return rawData;
                    } catch (error) {
                        log('error', '국회의원 명단 조회 실패:', error.message);
                        throw new Error(`국회의원 명단을 가져올 수 없습니다: ${error.message}`);
                    }
                },

                async getMemberPerformance() {
                    try {
                        const url = API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.MEMBER_PERFORMANCE;
                        log('debug', '국회의원 실적 데이터 조회 시작');
                        const rawData = await apiCallWithRetry(url);
                        log('success', `국회의원 실적 데이터 조회 완료`);
                        return rawData;
                    } catch (error) {
                        log('error', '국회의원 실적 데이터 조회 실패:', error.message);
                        throw new Error(`국회의원 실적 데이터를 가져올 수 없습니다: ${error.message}`);
                    }
                },

                async getMemberAttendance() {
                    try {
                        const url = API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.MEMBER_ATTENDANCE;
                        log('debug', '국회의원 출석 데이터 조회 시작');
                        const rawData = await apiCallWithRetry(url);
                        log('success', `국회의원 출석 데이터 조회 완료`);
                        return rawData;
                    } catch (error) {
                        log('error', '국회의원 출석 데이터 조회 실패:', error.message);
                        throw new Error(`국회의원 출석 데이터를 가져올 수 없습니다: ${error.message}`);
                    }
                },

                async getMemberBillCount() {
                    try {
                        const url = API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.MEMBER_BILL_COUNT;
                        log('debug', '국회의원 법안 수 데이터 조회 시작');
                        const rawData = await apiCallWithRetry(url);
                        log('success', `국회의원 법안 수 데이터 조회 완료`);
                        return rawData;
                    } catch (error) {
                        log('error', '국회의원 법안 수 데이터 조회 실패:', error.message);
                        throw new Error(`국회의원 법안 수 데이터를 가져올 수 없습니다: ${error.message}`);
                    }
                },

                async getMemberRanking() {
                    try {
                        const url = API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.MEMBER_RANKING;
                        log('debug', '국회의원 랭킹 데이터 조회 시작');
                        const rawData = await apiCallWithRetry(url);
                        log('success', `국회의원 랭킹 데이터 조회 완료`);
                        return rawData;
                    } catch (error) {
                        log('error', '국회의원 랭킹 데이터 조회 실패:', error.message);
                        throw new Error(`국회의원 랭킹 데이터를 가져올 수 없습니다: ${error.message}`);
                    }
                },

                async getMemberPhotos() {
                    try {
                        const url = API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.MEMBER_PHOTO;
                        log('debug', '국회의원 사진 데이터 조회 시작');
                        const rawData = await apiCallWithRetry(url);
                        log('success', `국회의원 사진 데이터 조회 완료`);
                        return rawData;
                    } catch (error) {
                        log('error', '국회의원 사진 데이터 조회 실패:', error.message);
                        throw new Error(`국회의원 사진 데이터를 가져올 수 없습니다: ${error.message}`);
                    }
                },

                // === 🏛️ 정당 관련 API ===
                async getPartyPerformance() {
                    try {
                        const url = API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.PARTY_PERFORMANCE;
                        log('debug', '정당 실적 데이터 조회 시작');
                        const rawData = await apiCallWithRetry(url);
                        log('success', `정당 실적 데이터 조회 완료`);
                        return rawData;
                    } catch (error) {
                        log('error', '정당 실적 데이터 조회 실패:', error.message);
                        throw new Error(`정당 실적 데이터를 가져올 수 없습니다: ${error.message}`);
                    }
                },

                async getPartyScoreRanking() {
                    try {
                        const url = API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.PARTY_RANKING_SCORE;
                        log('debug', '정당 점수 랭킹 데이터 조회 시작');
                        const rawData = await apiCallWithRetry(url);
                        log('success', `정당 점수 랭킹 데이터 조회 완료`);
                        return rawData;
                    } catch (error) {
                        log('error', '정당 점수 랭킹 데이터 조회 실패:', error.message);
                        throw new Error(`정당 점수 랭킹 데이터를 가져올 수 없습니다: ${error.message}`);
                    }
                },

                async getPartyStatsRanking() {
                    try {
                        const url = API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.PARTY_RANKING_STATS;
                        log('debug', '정당 통계 랭킹 데이터 조회 시작');
                        const rawData = await apiCallWithRetry(url);
                        log('success', `정당 통계 랭킹 데이터 조회 완료`);
                        return rawData;
                    } catch (error) {
                        log('error', '정당 통계 랭킹 데이터 조회 실패:', error.message);
                        throw new Error(`정당 통계 랭킹 데이터를 가져올 수 없습니다: ${error.message}`);
                    }
                },

                async getPartyMemberPerformance(partyName, order = 'desc', limit = null) {
                    try {
                        if (!validatePartyName(partyName)) {
                            throw new Error(`유효하지 않은 정당명입니다. 가능한 정당: ${VALID_PARTIES.join(', ')}`);
                        }

                        const trimmedParty = partyName.trim();
                        const encodedParty = encodeURIComponent(trimmedParty);
                        
                        let url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PARTY_MEMBER_PERFORMANCE}?party=${encodedParty}`;
                        
                        if (order) {
                            url += `&order=${order}`;
                        }
                        
                        if (limit) {
                            url += `&limit=${limit}`;
                        }
                        
                        log('debug', `정당별 의원 성과 조회: ${trimmedParty} (order: ${order}, limit: ${limit})`);
                        const rawData = await apiCallWithRetry(url);
                        log('success', `${trimmedParty} 의원 성과 조회 완료`);
                        return rawData;
                        
                    } catch (error) {
                        log('error', `정당별 의원 성과 조회 실패 (${partyName}):`, error.message);
                        throw new Error(`${partyName} 의원 성과 데이터를 가져올 수 없습니다: ${error.message}`);
                    }
                },

                async getPartyStats() {
                    try {
                        const url = API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.PARTY_STATS;
                        log('debug', '정당 통계 데이터 조회 시작');
                        const rawData = await apiCallWithRetry(url);
                        log('success', `정당 통계 데이터 조회 완료`);
                        return rawData;
                    } catch (error) {
                        log('error', '정당 통계 데이터 조회 실패:', error.message);
                        throw new Error(`정당 통계 데이터를 가져올 수 없습니다: ${error.message}`);
                    }
                },

                // === ⚖️ 비교 기능 API ===
                async compareMembers(member1, member2) {
                    try {
                        if (!member1 || !member2) {
                            throw new Error('두 명의 의원명을 모두 입력해주세요');
                        }

                        const trimmedMember1 = member1.trim();
                        const trimmedMember2 = member2.trim();
                        
                        if (trimmedMember1 === trimmedMember2) {
                            throw new Error('같은 의원을 비교할 수 없습니다');
                        }

                        const params = new URLSearchParams({
                            member1: trimmedMember1,
                            member2: trimmedMember2
                        });
                        
                        const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.COMPARE_MEMBERS}?${params}`;
                        
                        log('debug', `의원 비교 조회: ${trimmedMember1} vs ${trimmedMember2}`);
                        const rawData = await apiCallWithRetry(url);
                        log('success', `의원 비교 완료: ${trimmedMember1} vs ${trimmedMember2}`);
                        return rawData;
                        
                    } catch (error) {
                        log('error', `의원 비교 실패 (${member1} vs ${member2}):`, error.message);
                        throw new Error(`의원 비교에 실패했습니다: ${error.message}`);
                    }
                },

                async compareParties(party1, party2) {
                    try {
                        if (!party1 || !party2) {
                            throw new Error('두 개의 정당명을 모두 입력해주세요');
                        }
                        
                        if (!validatePartyName(party1) || !validatePartyName(party2)) {
                            throw new Error(`유효하지 않은 정당명입니다. 가능한 정당: ${VALID_PARTIES.join(', ')}`);
                        }

                        const trimmedParty1 = party1.trim();
                        const trimmedParty2 = party2.trim();
                        
                        if (trimmedParty1 === trimmedParty2) {
                            throw new Error('같은 정당을 비교할 수 없습니다');
                        }

                        const params = new URLSearchParams({
                            party1: trimmedParty1,
                            party2: trimmedParty2
                        });
                        
                        const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.COMPARE_PARTIES}?${params}`;
                        
                        log('debug', `정당 비교 조회: ${trimmedParty1} vs ${trimmedParty2}`);
                        const rawData = await apiCallWithRetry(url);
                        log('success', `정당 비교 완료: ${trimmedParty1} vs ${trimmedParty2}`);
                        return rawData;
                        
                    } catch (error) {
                        log('error', `정당 비교 실패 (${party1} vs ${party2}):`, error.message);
                        throw new Error(`정당 비교에 실패했습니다: ${error.message}`);
                    }
                },

                // === 🤖 챗봇 API ===
                async sendChatbotMessage(message, options = {}) {
                    try {
                        if (!message || typeof message !== 'string') {
                            throw new Error('메시지를 입력해주세요');
                        }

                        const trimmedMessage = message.trim();
                        if (trimmedMessage.length === 0) {
                            throw new Error('빈 메시지는 전송할 수 없습니다');
                        }

                        const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CHATBOT}`;
                        
                        const requestBody = {
                            message: trimmedMessage,
                            ...options
                        };
                        
                        log('debug', `챗봇 메시지 전송: ${trimmedMessage.substring(0, 50)}...`);
                        
                        const rawData = await apiCallWithRetry(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(requestBody)
                        });
                        
                        log('success', '챗봇 응답 수신 완료');
                        return rawData;
                        
                    } catch (error) {
                        log('error', '챗봇 메시지 전송 실패:', error.message);
                        throw new Error(`챗봇과의 통신에 실패했습니다: ${error.message}`);
                    }
                },

                // === ⚙️ 가중치 업데이트 API ===
                async updateWeights(weights) {
                    try {
                        const url = API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.UPDATE_WEIGHTS;
                        log('debug', '가중치 업데이트 요청:', weights);
                        
                        const rawData = await apiCallWithRetry(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(weights)
                        });
                        
                        log('success', '가중치 업데이트 성공');
                        
                        // 가중치 변경 이벤트 발생
                        try {
                            const event = {
                                type: 'weights_updated',
                                timestamp: new Date().toISOString(),
                                weights: weights
                            };
                            localStorage.setItem('weight_change_event', JSON.stringify(event));
                            localStorage.setItem('last_weight_update', Date.now().toString());
                            setTimeout(() => localStorage.removeItem('weight_change_event'), 100);
                        } catch (e) {
                            log('warning', '가중치 변경 이벤트 발생 실패:', e.message);
                        }
                        
                        return rawData;
                    } catch (error) {
                        log('error', '가중치 업데이트 실패:', error.message);
                        throw new Error(`가중치 업데이트에 실패했습니다: ${error.message}`);
                    }
                },

                // === 🔧 유틸리티 함수들 ===
                getValidParties() {
                    return [...VALID_PARTIES];
                },

                validatePartyName(partyName) {
                    return validatePartyName(partyName);
                },

                // === 🔄 호환성을 위한 별칭 함수들 ===
                async getPerformanceData() {
                    return this.getMemberPerformance();
                },

                async getPartyWeightedPerformanceData() {
                    return this.getPartyPerformance();
                },

                async getPartyRanking() {
                    return this.getPartyScoreRanking();
                },

                async getMemberScoreRanking() {
                    return this.getMemberRanking();
                },

                async compareMembersAdvanced(member1, member2) {
                    return this.compareMembers(member1, member2);
                },

                async comparePartiesAdvanced(party1, party2) {
                    return this.compareParties(party1, party2);
                },

                // === ⚙️ 설정 및 환경 정보 ===
                config: {
                    getBaseUrl: () => API_CONFIG.BASE_URL,
                    getTimeout: () => API_CONFIG.TIMEOUT,
                    isDebugMode: () => DEBUG_MODE,
                    getValidParties: () => [...VALID_PARTIES],
                    getEndpoints: () => ({ ...API_CONFIG.ENDPOINTS }),
                    getVersion: () => '2.1.0'
                },

                _isReady: false,
                _hasError: false,
                _initTime: Date.now(),
                _version: '2.1.0'
            };

        } catch (error) {
            log('error', 'APIService 생성 실패:', error);
            
            return {
                showNotification: (msg, type) => console.log(`[${type}] ${msg}`),
                getEnvironmentInfo: () => ({ isVercel: false, isLocal: true, error: 'Service creation failed' }),
                _isReady: false,
                _hasError: true,
                _error: error.message
            };
        }
    }

    // === 🚀 APIService 초기화 및 등록 ===
    try {
        const apiService = createAPIService();
        
        if (window.APIService && typeof window.APIService === 'object') {
            Object.assign(window.APIService, apiService);
            window.APIService._isReady = true;
        } else {
            window.APIService = apiService;
            window.APIService._isReady = true;
        }

        log('success', '🚀 APIService 초기화 완료 (v2.1.0 - 업데이트된 Django API 연동)');

    } catch (error) {
        log('error', '🚨 APIService 초기화 실패:', error);
        
        if (!window.APIService) {
            window.APIService = {
                showNotification: (msg, type) => console.log(`[${type}] ${msg}`),
                getEnvironmentInfo: () => ({ error: 'Init failed' }),
                _isReady: false,
                _hasError: true
            };
        }
    }

    // === 🔧 전역 유틸리티 함수들 ===
    try {
        if (typeof window.formatNumber === 'undefined') {
            window.formatNumber = function(num) {
                try {
                    return new Intl.NumberFormat('ko-KR').format(num);
                } catch (e) {
                    return String(num);
                }
            };
        }

        if (typeof window.debounce === 'undefined') {
            window.debounce = function(func, delay) {
                let timeoutId;
                return function (...args) {
                    clearTimeout(timeoutId);
                    timeoutId = setTimeout(() => func.apply(this, args), delay);
                };
            };
        }

        if (typeof window.formatDate === 'undefined') {
            window.formatDate = function(dateString) {
                try {
                    const date = new Date(dateString);
                    return date.toLocaleDateString('ko-KR');
                } catch (e) {
                    return dateString;
                }
            };
        }

        if (typeof window.formatPercentage === 'undefined') {
            window.formatPercentage = function(num) {
                try {
                    return `${parseFloat(num).toFixed(1)}%`;
                } catch (e) {
                    return '0.0%';
                }
            };
        }
    } catch (error) {
        log('error', '전역 함수 등록 실패:', error);
    }

    function initializeAfterDOM() {
        try {
            log('info', `🌐 환경: ${window.APIService.getEnvironmentInfo().isVercel ? 'Vercel' : 'Local'}`);
            log('info', `🔧 API 서버: ${API_CONFIG.BASE_URL}`);
            log('info', `🏛️ 지원 정당: ${VALID_PARTIES.length}개`);
            log('info', `📡 API 엔드포인트: ${Object.keys(API_CONFIG.ENDPOINTS).length}개`);
            
            if (!window._networkListenersAdded) {
                window.addEventListener('online', () => {
                    showNotification('네트워크 연결 복구', 'success', 2000);
                });
                
                window.addEventListener('offline', () => {
                    showNotification('네트워크 연결 끊어짐', 'warning', 2000);
                });
                
                window._networkListenersAdded = true;
            }
        } catch (error) {
            log('error', 'DOM 초기화 실패:', error);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAfterDOM);
    } else {
        setTimeout(initializeAfterDOM, 0);
    }

    log('success', '✅ global_sync.js 로드 완료 (v2.1.0 - 업데이트된 Django API 연동)');

})();
