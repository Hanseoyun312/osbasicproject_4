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

// ===== 🛠️ 무한루프 완전 해결 - 전역 동기화 관리자 v2.0 =====
class GlobalSyncManager {
    constructor() {
        this.channel = null;
        this.isInitialized = false;
        this.apiBaseUrl = 'https://baekilha.onrender.com';
        
        // 🔧 무한루프 방지를 위한 상태 관리
        this.isProcessing = false;
        this.lastProcessedId = null;
        this.lastProcessedTime = null;
        this.processedMessages = new Set(); // 처리된 메시지 ID 저장
        this.PROCESSING_TIMEOUT = 5000; // 5초 타임아웃
        this.MESSAGE_LIFETIME = 30000; // 메시지 ID 30초 보관
        
        this.originalData = {
            parties: null,
            members: null,
            billCounts: null
        };
        this.calculatedData = {
            parties: null,
            members: null
        };
        this.currentWeights = {
            '간사': 3,
            '무효표 및 기권': 2,
            '본회의 가결': 40,
            '위원장': 5,
            '청원 소개': 8,
            '청원 결과': 23,
            '출석': 8,
            '투표 결과 일치': 7,
            '투표 결과 불일치': 4
        };
        this.init();
    }

    async init() {
        try {
            await this.initBroadcastChannel();
            await this.loadOriginalData();
            this.setupEventListeners();
            this.isInitialized = true;
            console.log('🟢 GlobalSyncManager v2.0 초기화 완료 (무한루프 방지)');
        } catch (error) {
            console.error('❌ GlobalSyncManager 초기화 실패:', error);
        }
    }

    async initBroadcastChannel() {
        if (typeof BroadcastChannel !== 'undefined') {
            this.channel = new BroadcastChannel('client_weight_updates_v4');
            this.channel.addEventListener('message', this.handleBroadcastMessage.bind(this));
            console.log('📡 BroadcastChannel 초기화 완료');
        } else {
            console.warn('⚠️ BroadcastChannel 미지원');
        }
    }

    async loadOriginalData() {
        try {
            console.log('🔄 원본 데이터 로딩 시작...');
            
            // 병렬로 API 호출
            const [partiesResponse, membersResponse, billCountsResponse] = await Promise.all([
                fetch(`${this.apiBaseUrl}/performance/api/party_performance/`),
                fetch(`${this.apiBaseUrl}/performance/api/performance/`),
                fetch(`${this.apiBaseUrl}/legislation/bill-count/`)
            ]);

            if (!partiesResponse.ok || !membersResponse.ok || !billCountsResponse.ok) {
                throw new Error('API 응답 오류');
            }

            const partiesData = await partiesResponse.json();
            const membersData = await membersResponse.json();
            const billCountsData = await billCountsResponse.json();

            this.originalData = {
                parties: partiesData.party_ranking || partiesData,
                members: membersData.ranking || membersData,
                billCounts: billCountsData
            };

            console.log('✅ 원본 데이터 로딩 완료');
            console.log(`📊 정당: ${this.originalData.parties.length}개`);
            console.log(`👥 의원: ${this.originalData.members.length}명`);
            console.log(`📋 법안: ${this.originalData.billCounts.length}건`);

        } catch (error) {
            console.error('❌ 원본 데이터 로딩 실패:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // 🔧 localStorage 이벤트는 제거 (BroadcastChannel만 사용)
        // localStorage 변경 감지 제거하여 중복 처리 방지
        
        // 연결 확인 요청 처리
        if (this.channel) {
            this.channel.addEventListener('message', (event) => {
                if (event.data.type === 'connection_check') {
                    this.sendConnectionResponse();
                }
            });
        }
        
        console.log('🔧 이벤트 리스너 설정 완료 (localStorage 이벤트 제거)');
    }

    sendConnectionResponse() {
        if (this.channel) {
            this.channel.postMessage({
                type: 'connection_response',
                source: 'global_sync_manager', // 연결 확인은 실제 소스 표시
                data_mode: 'api_integrated',
                timestamp: new Date().toISOString()
            });
        }
    }

    // 🔧 메시지 중복 처리 방지 로직
    isMessageAlreadyProcessed(messageId, messageTime) {
        // 1. 메시지 ID 중복 체크
        if (this.processedMessages.has(messageId)) {
            console.log(`[GlobalSync] 중복 메시지 스킵: ${messageId}`);
            return true;
        }
        
        // 2. 시간 기반 중복 체크 (1초 이내 연속 메시지)
        if (this.lastProcessedTime && 
            messageTime && 
            Math.abs(new Date(messageTime).getTime() - new Date(this.lastProcessedTime).getTime()) < 1000) {
            console.log(`[GlobalSync] 시간 기반 중복 메시지 스킵`);
            return true;
        }
        
        return false;
    }

    // 🔧 처리된 메시지 ID 정리
    cleanupProcessedMessages() {
        const now = Date.now();
        const cutoff = now - this.MESSAGE_LIFETIME;
        
        // 30초 이전 메시지 ID들 제거
        for (const messageId of this.processedMessages) {
            const messageTime = messageId.split('_')[0];
            if (messageTime && parseInt(messageTime) < cutoff) {
                this.processedMessages.delete(messageId);
            }
        }
    }

    handleBroadcastMessage(event) {
        const data = event.data;
        
        // 🔧 자신이 보낸 메시지 무시 (original_source 체크)
        if (data.original_source === 'global_sync_manager') {
            console.log(`[GlobalSync] 자신이 보낸 메시지 무시: ${data.type}`);
            return;
        }
        
        // 🔧 메시지 중복 처리 방지
        if (data.id && this.isMessageAlreadyProcessed(data.id, data.timestamp)) {
            return;
        }
        
        // 🔧 현재 처리 중인 상태 체크
        if (this.isProcessing) {
            console.log(`[GlobalSync] 처리 중이므로 메시지 스킵: ${data.type}`);
            return;
        }
        
        console.log(`[GlobalSync] 📡 메시지 수신: ${data.type} (from: ${data.source})`);
        
        switch (data.type) {
            case 'calculated_data_distribution':
                if (data.source === 'percent_page' && !data.original_source) {
                    // percent.js에서 직접 온 메시지만 처리 (자신이 보낸 건 제외)
                    this.handleWeightUpdateFromPercent(data);
                }
                break;
            case 'data_reset_to_original':
                if (data.source === 'percent_page') {
                    this.resetToOriginalData();
                }
                break;
            case 'test_broadcast':
                console.log('📡 테스트 브로드캐스트 수신:', data.message);
                break;
        }
    }

    // 🔧 percent.js에서 오는 가중치 업데이트만 처리
    async handleWeightUpdateFromPercent(data) {
        // 🔧 이미 처리 중인지 확인
        if (this.isProcessing) {
            console.log('[GlobalSync] 이미 처리 중이므로 가중치 업데이트 스킵');
            return;
        }
        
        try {
            this.isProcessing = true;
            
            // 🔧 메시지 ID 기록
            if (data.id) {
                this.processedMessages.add(data.id);
                this.lastProcessedId = data.id;
            }
            this.lastProcessedTime = data.timestamp;
            
            // 🔧 처리 타임아웃 설정
            const timeoutId = setTimeout(() => {
                console.warn('[GlobalSync] 처리 타임아웃 - 강제 리셋');
                this.isProcessing = false;
            }, this.PROCESSING_TIMEOUT);
            
            console.log('[GlobalSync] 🎯 percent.js에서 가중치 업데이트 수신');
            
            // 🔧 percent.js에서 이미 계산된 데이터를 받았으므로 
            // 추가 계산 없이 그대로 다른 페이지들에게 전달
            if (data.partyData && data.memberData) {
                console.log('[GlobalSync] 📡 계산된 데이터를 다른 페이지들에게 전달');
                
                // 🔧 source를 global_sync_manager로 변경하여 재전송
                const forwardData = {
                    ...data,
                    source: 'global_sync_manager', // source 변경
                    forwarded_from: 'percent_page',
                    forwarded_at: new Date().toISOString()
                };
                
                // 🔧 다른 페이지들에게만 전달 (percent.js에는 다시 보내지 않음)
                if (this.channel) {
                    this.channel.postMessage(forwardData);
                }
                
                console.log('[GlobalSync] ✅ 계산된 데이터 전달 완료');
            }
            
            // 타임아웃 정리
            clearTimeout(timeoutId);
            
        } catch (error) {
            console.error('[GlobalSync] ❌ 가중치 업데이트 처리 실패:', error);
        } finally {
            // 🔧 처리 완료 후 상태 리셋 (2초 지연)
            setTimeout(() => {
                this.isProcessing = false;
                this.cleanupProcessedMessages(); // 오래된 메시지 ID 정리
                console.log('[GlobalSync] 처리 상태 리셋 완료');
            }, 2000);
        }
    }

    async resetToOriginalData() {
        if (this.isProcessing) {
            console.log('[GlobalSync] 처리 중이므로 리셋 스킵');
            return;
        }
        
        try {
            this.isProcessing = true;
            console.log('[GlobalSync] 🔄 원본 데이터로 리셋 중...');
            
            // 원본 데이터 다시 로드
            await this.loadOriginalData();
            
            // 원본 데이터를 계산된 데이터로 복사
            this.calculatedData.parties = this.originalData.parties.map((party, index) => ({
                rank: index + 1,
                name: party.party,
                calculated_score: party.avg_total_score,
                original_score: party.avg_total_score,
                score_changed: false,
                weight_applied: false,
                member_count: party.member_count
            }));

            this.calculatedData.members = this.originalData.members.map((member, index) => ({
                rank: index + 1,
                name: member.lawmaker_name,
                party: member.party,
                calculated_score: member.total_score,
                original_score: member.total_score,
                score_changed: false,
                weight_applied: false,
                lawmaker_id: member.lawmaker
            }));

            // 원본 데이터 브로드캐스트
            this.broadcastOriginalData();
            
            console.log('[GlobalSync] ✅ 원본 데이터 리셋 완료');
        } catch (error) {
            console.error('[GlobalSync] ❌ 원본 데이터 리셋 실패:', error);
        } finally {
            setTimeout(() => {
                this.isProcessing = false;
            }, 1000);
        }
    }

    broadcastOriginalData() {
        const originalData = {
            type: 'data_reset_to_original',
            source: 'percent_page', // 🔧 다른 페이지들이 인식할 수 있도록 percent_page로 위장
            original_source: 'global_sync_manager', // 실제 출처 기록
            timestamp: new Date().toISOString(),
            action: 'reset_completed',
            
            partyData: {
                total: this.calculatedData.parties.length,
                top3: this.calculatedData.parties.slice(0, 3),
                full_list: this.calculatedData.parties
            },
            
            memberData: {
                total: this.calculatedData.members.length,
                top3: this.calculatedData.members.slice(0, 3),
                full_list: this.calculatedData.members
            },
            
            calculationInfo: {
                member_count: this.calculatedData.members.length,
                party_count: this.calculatedData.parties.length,
                calculation_method: 'original',
                api_sources: [
                    '/performance/api/party_performance/',
                    '/performance/api/performance/',
                    '/legislation/bill-count/'
                ]
            }
        };

        // BroadcastChannel로 전송
        if (this.channel) {
            this.channel.postMessage(originalData);
        }

        console.log('[GlobalSync] 📡 원본 데이터 브로드캐스트 완료 (source: percent_page로 위장)');
    }

    // === 🎯 실제 가중치 계산 로직들 ===
    
    async calculateScoresWithWeights() {
        if (!this.originalData.parties || !this.originalData.members || !this.originalData.billCounts) {
            throw new Error('원본 데이터가 없습니다');
        }

        console.log('[GlobalSync] 📊 가중치 기반 점수 계산 시작...');
        
        // 🔧 DEBUG: 계산 전 상태 확인
        console.log('[GlobalSync] 🔧 DEBUG: 원본 데이터 상태');
        console.log('- 원본 정당:', this.originalData.parties.length);
        console.log('- 원본 의원:', this.originalData.members.length);
        console.log('- 법안 데이터:', this.originalData.billCounts.length);
        
        // 정당 점수 계산
        console.log('[GlobalSync] 🔧 DEBUG: 정당 점수 계산 시작...');
        const calculatedParties = this.calculatePartyScores();
        console.log('[GlobalSync] 🔧 DEBUG: 정당 점수 계산 결과:', calculatedParties.length);
        this.calculatedData.parties = calculatedParties;
        
        // 의원 점수 계산
        console.log('[GlobalSync] 🔧 DEBUG: 의원 점수 계산 시작...');
        const calculatedMembers = this.calculateMemberScores();
        console.log('[GlobalSync] 🔧 DEBUG: 의원 점수 계산 결과:', calculatedMembers.length);
        this.calculatedData.members = calculatedMembers;
        
        // 🔧 DEBUG: 계산 후 상태 확인
        console.log('[GlobalSync] 🔧 DEBUG: 계산 완료 후 상태');
        console.log('- this.calculatedData.parties:', this.calculatedData.parties?.length);
        console.log('- this.calculatedData.members:', this.calculatedData.members?.length);
        
        if (this.calculatedData.parties?.length > 0) {
            console.log('[GlobalSync] 🔧 DEBUG: 1위 정당:', this.calculatedData.parties[0]);
        }
        
        if (this.calculatedData.members?.length > 0) {
            console.log('[GlobalSync] 🔧 DEBUG: 1위 의원:', this.calculatedData.members[0]);
        }

        console.log('[GlobalSync] ✅ 새로운 점수 계산 완료');
    }

    calculatePartyScores() {
        const parties = this.originalData.parties.map(party => {
            const scores = {};
            let totalScore = 0;

            // 각 가중치 항목별 점수 계산
            scores.attendance = (party.avg_attendance || 85) * (this.currentWeights['출석'] / 100);
            scores.invalidVote = (100 - (party.avg_invalid_vote_ratio || 2)) * (this.currentWeights['무효표 및 기권'] / 100);
            scores.voteMatch = (party.avg_vote_match_ratio || 90) * (this.currentWeights['투표 결과 일치'] / 100);
            scores.voteMismatch = (100 - (party.avg_vote_mismatch_ratio || 10)) * (this.currentWeights['투표 결과 불일치'] / 100);
            
            // 본회의 가결을 퍼센트로 변환
            const maxBillPass = Math.max(...this.originalData.parties.map(p => p.bill_pass_sum || 0));
            scores.billPass = maxBillPass > 0 ? 
                ((party.bill_pass_sum || 0) / maxBillPass) * 100 * (this.currentWeights['본회의 가결'] / 100) : 0;
            
            // 청원 관련 퍼센트 변환
            const maxPetition = Math.max(...this.originalData.parties.map(p => p.petition_sum || 0));
            const maxPetitionPass = Math.max(...this.originalData.parties.map(p => p.petition_pass_sum || 0));
            
            scores.petition = maxPetition > 0 ? 
                ((party.petition_sum || 0) / maxPetition) * 100 * (this.currentWeights['청원 소개'] / 100) : 0;
            scores.petitionResult = maxPetitionPass > 0 ? 
                ((party.petition_pass_sum || 0) / maxPetitionPass) * 100 * (this.currentWeights['청원 결과'] / 100) : 0;
            
            // 위원장/간사 점수
            scores.leader = (party.committee_leader_count || 0) * (this.currentWeights['위원장'] / 10);
            scores.secretary = (party.committee_secretary_count || 0) * (this.currentWeights['간사'] / 10);
            
            // 총점 계산
            totalScore = Object.values(scores).reduce((sum, score) => sum + (isNaN(score) ? 0 : score), 0);
            
            // 100점을 넘지 않도록 정규화
            if (totalScore > 100) {
                const factor = 100 / totalScore;
                Object.keys(scores).forEach(key => {
                    scores[key] *= factor;
                });
                totalScore = 100;
            }

            return {
                rank: 0, // 나중에 정렬 후 할당
                name: party.party || '정당명 없음',
                calculated_score: Math.round(totalScore * 10) / 10,
                original_score: party.avg_total_score || 0,
                score_changed: Math.abs(totalScore - (party.avg_total_score || 0)) > 0.1,
                weight_applied: true,
                detailed_scores: scores,
                member_count: party.member_count || 0
            };
        });

        // 점수 순으로 정렬하고 순위 할당
        parties.sort((a, b) => b.calculated_score - a.calculated_score);
        parties.forEach((party, index) => {
            party.rank = index + 1;
        });

        console.log(`[GlobalSync] 정당 점수 계산 완료: ${parties.length}개`);
        return parties;
    }

    calculateMemberScores() {
        // 법안 수 데이터를 의원별로 매핑
        const billCountMap = {};
        this.originalData.billCounts.forEach(bill => {
            if (bill.id && bill.total !== undefined) {
                billCountMap[bill.id] = bill.total;
            }
        });

        const members = this.originalData.members.map(member => {
            const scores = {};
            let totalScore = 0;

            // 각 가중치 항목별 점수 계산
            scores.attendance = (member.attendance_score || 85) * (this.currentWeights['출석'] / 100);
            scores.invalidVote = (100 - (member.invalid_vote_ratio || 2)) * (this.currentWeights['무효표 및 기권'] / 100);
            scores.voteMatch = (member.vote_match_ratio || 90) * (this.currentWeights['투표 결과 일치'] / 100);
            scores.voteMismatch = (100 - (member.vote_mismatch_ratio || 10)) * (this.currentWeights['투표 결과 불일치'] / 100);
            
            // 본회의 제안을 퍼센트로 변환
            const memberBillCount = billCountMap[member.lawmaker] || 0;
            const maxBillCount = Math.max(...Object.values(billCountMap));
            scores.billProposal = maxBillCount > 0 ? 
                (memberBillCount / maxBillCount) * 100 * (this.currentWeights['본회의 가결'] / 100) : 0;
            
            // 청원 관련
            scores.petition = (member.petition_score || 0) * (this.currentWeights['청원 소개'] / 100);
            scores.petitionResult = (member.petition_result_score || 0) * (this.currentWeights['청원 결과'] / 100);
            
            // 위원장/간사 점수
            scores.leader = (member.committee_leader_count || 0) * (this.currentWeights['위원장'] / 10);
            scores.secretary = (member.committee_secretary_count || 0) * (this.currentWeights['간사'] / 10);
            
            // 총점 계산
            totalScore = Object.values(scores).reduce((sum, score) => sum + (isNaN(score) ? 0 : score), 0);
            
            // 100점을 넘지 않도록 정규화
            if (totalScore > 100) {
                const factor = 100 / totalScore;
                Object.keys(scores).forEach(key => {
                    scores[key] *= factor;
                });
                totalScore = 100;
            }

            return {
                rank: 0, // 나중에 정렬 후 할당
                name: member.lawmaker_name || '의원명 없음',
                party: member.party || '정당 정보 없음',
                calculated_score: Math.round(totalScore * 10) / 10,
                original_score: member.total_score || 0,
                score_changed: Math.abs(totalScore - (member.total_score || 0)) > 0.1,
                weight_applied: true,
                detailed_scores: scores,
                lawmaker_id: member.lawmaker
            };
        });

        // 점수 순으로 정렬하고 순위 할당
        members.sort((a, b) => b.calculated_score - a.calculated_score);
        members.forEach((member, index) => {
            member.rank = index + 1;
        });

        console.log(`[GlobalSync] 의원 점수 계산 완료: ${members.length}명`);
        return members;
    }

    broadcastCalculatedData() {
        // 🔧 데이터 유효성 검증
        if (!this.calculatedData.parties || this.calculatedData.parties.length === 0) {
            console.error('[GlobalSync] ❌ 계산된 정당 데이터가 없습니다');
            return;
        }
        
        if (!this.calculatedData.members || this.calculatedData.members.length === 0) {
            console.error('[GlobalSync] ❌ 계산된 의원 데이터가 없습니다');
            return;
        }
        
        console.log(`[GlobalSync] 📊 브로드캐스트할 데이터 - 정당: ${this.calculatedData.parties.length}개, 의원: ${this.calculatedData.members.length}명`);
        
        const calculatedData = {
            type: 'calculated_data_distribution',
            source: 'percent_page', // 🔧 다른 페이지들이 인식할 수 있도록 percent_page로 위장
            original_source: 'global_sync_manager', // 실제 출처 기록
            timestamp: new Date().toISOString(),
            appliedWeights: this.currentWeights,
            
            partyData: {
                total: this.calculatedData.parties.length,
                top3: this.calculatedData.parties.slice(0, 3).map(party => ({
                    rank: party.rank,
                    name: party.name,
                    score: party.calculated_score,
                    calculated_score: party.calculated_score,
                    original_score: party.original_score,
                    score_changed: party.score_changed,
                    weight_applied: party.weight_applied
                })),
                full_list: this.calculatedData.parties
            },
            
            memberData: {
                total: this.calculatedData.members.length,
                top3: this.calculatedData.members.slice(0, 3).map(member => ({
                    rank: member.rank,
                    name: member.name,
                    party: member.party,
                    score: member.calculated_score,
                    calculated_score: member.calculated_score,
                    original_score: member.original_score,
                    score_changed: member.score_changed,
                    weight_applied: member.weight_applied
                })),
                full_list: this.calculatedData.members
            },
            
            calculationInfo: {
                member_count: this.calculatedData.members.length,
                party_count: this.calculatedData.parties.length,
                calculation_method: 'api_weighted',
                api_sources: [
                    '/performance/api/party_performance/',
                    '/performance/api/performance/',
                    '/legislation/bill-count/'
                ]
            }
        };
        
        // 🔧 브로드캐스트 전에 데이터 구조 로깅
        console.log('[GlobalSync] 📡 브로드캐스트 데이터 미리보기:');
        console.log('- partyData.full_list 길이:', calculatedData.partyData.full_list.length);
        console.log('- memberData.full_list 길이:', calculatedData.memberData.full_list.length);
        console.log('- TOP 정당:', calculatedData.partyData.top3[0]?.name);
        console.log('- TOP 의원:', calculatedData.memberData.top3[0]?.name);

        // BroadcastChannel로 전송
        if (this.channel) {
            this.channel.postMessage(calculatedData);
            console.log('[GlobalSync] 📡 계산된 데이터 브로드캐스트 전송 (source: percent_page로 위장)');
        }

        console.log('[GlobalSync] 📡 계산된 데이터 브로드캐스트 완료');
    }

    // 현재 상태 조회 메서드
    getCurrentData() {
        return {
            original: this.originalData,
            calculated: this.calculatedData,
            weights: this.currentWeights
        };
    }

    // 🔧 가중치 업데이트 메서드 (실제 계산 수행)
    async updateWeights(newWeights) {
        if (this.isProcessing) {
            console.log('[GlobalSync] 이미 처리 중이므로 가중치 업데이트 스킵');
            return;
        }
        
        try {
            this.isProcessing = true;
            console.log('[GlobalSync] 🎯 가중치 업데이트 시작:', newWeights);
            
            this.currentWeights = { ...newWeights };
            await this.calculateScoresWithWeights();
            this.broadcastCalculatedData();
            
            console.log('[GlobalSync] ✅ 가중치 업데이트 및 브로드캐스트 완료');
            
        } catch (error) {
            console.error('[GlobalSync] ❌ 가중치 업데이트 실패:', error);
            throw error;
        } finally {
            setTimeout(() => {
                this.isProcessing = false;
            }, 1000);
        }
    }
}

// 전역 인스턴스 생성
let globalSyncManager = null;

// DOM 로드 후 초기화
document.addEventListener('DOMContentLoaded', () => {
    globalSyncManager = new GlobalSyncManager();
});

// 전역 접근을 위한 함수들
window.getGlobalSyncManager = () => globalSyncManager;
window.getCurrentSyncData = () => globalSyncManager ? globalSyncManager.getCurrentData() : null;
window.updateGlobalWeights = (weights) => {
    if (globalSyncManager && globalSyncManager.isInitialized) {
        console.log('[GlobalSync] 전역 가중치 업데이트 요청:', weights);
        return globalSyncManager.updateWeights(weights);
    } else {
        console.warn('[GlobalSync] GlobalSyncManager가 초기화되지 않음');
        return null;
    }
};