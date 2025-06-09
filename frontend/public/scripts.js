// === 🔧 전역 퍼센트 설정 관리 (Django API 연동 버전) ===
window.PercentManager = {
    // 퍼센트 설정 가져오기 (로컬 + 서버 동기화)
    getSettings: function() {
        const savedData = localStorage.getItem('percentSettings');
        if (savedData) {
            try {
                return JSON.parse(savedData);
            } catch (error) {
                console.error('[PercentManager] 설정 파싱 실패:', error);
                localStorage.removeItem('percentSettings');
                return null;
            }
        }
        return null;
    },
    
    // 특정 항목의 퍼센트 값 가져오기
    getValue: function(itemName) {
        const settings = this.getSettings();
        if (settings && settings[itemName]) {
            return settings[itemName].enabled ? settings[itemName].value : 0;
        }
        return 0;
    },
    
    // 특정 항목이 활성화되어 있는지 확인
    isEnabled: function(itemName) {
        const settings = this.getSettings();
        if (settings && settings[itemName]) {
            return settings[itemName].enabled;
        }
        return false;
    },
    
    // 백엔드로 전송할 퍼센트 설정 포맷 변환
    getSettingsForBackend: function() {
        const settings = this.getSettings();
        if (!settings) return null;
        
        // Django API가 원하는 형식으로 변환
        const backendFormat = {};
        Object.keys(settings).forEach(key => {
            if (settings[key].enabled) {
                backendFormat[key] = parseFloat(settings[key].value) || 0;
            }
        });
        
        return Object.keys(backendFormat).length > 0 ? backendFormat : null;
    },
    
    // 새로운 API 서비스를 통한 설정 전송
    sendSettingsToBackend: async function() {
        const weights = this.getSettingsForBackend();
        if (!weights) {
            console.warn('[PercentManager] 전송할 퍼센트 설정이 없습니다.');
            return null;
        }
        
        try {
            console.log('[PercentManager] 퍼센트 설정을 서버에 전송 중...', weights);
            
            // 새로운 APIService 사용
            if (window.APIService && typeof window.APIService.updateWeights === 'function') {
                const result = await window.APIService.updateWeights(weights);
                console.log('[PercentManager] 퍼센트 설정 전송 성공:', result);
                
                // 성공 알림 표시
                if (window.APIService.showNotification) {
                    window.APIService.showNotification('퍼센트 설정이 서버에 저장되었습니다! 🎉', 'success');
                }
                
                // 가중치 변경 이벤트는 updateWeights 함수 내에서 자동으로 발생됨
                
                return result;
                
            } else {
                throw new Error('APIService를 사용할 수 없습니다.');
            }
            
        } catch (error) {
            console.error('[PercentManager] 퍼센트 설정 전송 실패:', error);
            
            // 실패 알림 표시
            if (window.APIService && window.APIService.showNotification) {
                window.APIService.showNotification(`퍼센트 설정 저장에 실패했습니다: ${error.message}`, 'error');
            }
            
            throw error;
        }
    },
    
    // 설정이 있는지 확인
    hasSettings: function() {
        return localStorage.getItem('percentSettings') !== null;
    },
    
    // 설정 저장 (로컬 + 서버)
    saveSettings: async function(settings) {
        try {
            // 로컬 저장
            localStorage.setItem('percentSettings', JSON.stringify(settings));
            console.log('[PercentManager] 로컬에 퍼센트 설정 저장 완료');
            
            // 서버 전송 (선택적)
            try {
                await this.sendSettingsToBackend();
                return { success: true, savedToServer: true };
            } catch (serverError) {
                console.warn('[PercentManager] 서버 전송 실패, 로컬에만 저장됨:', serverError.message);
                return { success: true, savedToServer: false, error: serverError.message };
            }
            
        } catch (error) {
            console.error('[PercentManager] 설정 저장 중 오류:', error);
            return { success: false, error: error.message };
        }
    },
    
    // 서버에서 설정 불러오기 (향후 확장용)
    loadSettingsFromServer: async function() {
        try {
            // 향후 서버에서 가중치 설정을 불러오는 API가 추가되면 여기에 구현
            console.log('[PercentManager] 서버에서 설정 불러오기는 아직 지원되지 않습니다.');
            return null;
        } catch (error) {
            console.error('[PercentManager] 서버 설정 불러오기 실패:', error);
            return null;
        }
    }
};

// === 🚨 메뉴바 핵심 기능 - 최우선 실행 (API 독립적) ===
function initializeMenuBar() {
    try {
        console.log('🎯 메뉴바 초기화 시작...');
        
        const navItems = document.querySelectorAll('nav li');
        const submenuWrappers = document.querySelectorAll('.submenu-wrapper');
        
        if (navItems.length === 0) {
            console.error('❌ 네비게이션 요소를 찾을 수 없습니다.');
            return false;
        }
        
        // 모든 서브메뉴 숨기기
        function hideAllSubmenus() {
            submenuWrappers.forEach(submenu => {
                submenu.style.display = 'none';
            });
        }
        
        // 메뉴 클릭 이벤트
        navItems.forEach(item => {
            item.addEventListener('click', function() {
                const submenuId = this.getAttribute('data-submenu');
                const submenu = document.getElementById(submenuId);
                
                // 이미 활성화된 탭을 클릭한 경우
                if (this.classList.contains('active')) {
                    this.classList.remove('active');
                    hideAllSubmenus();
                    return;
                }
                
                // 모든 탭에서 active 클래스 제거
                navItems.forEach(i => i.classList.remove('active'));
                
                // 클릭한 탭에 active 클래스 추가
                this.classList.add('active');
                
                // 서브메뉴가 있는 메뉴인 경우 서브메뉴 표시
                if (submenuId && submenu) {
                    hideAllSubmenus();
                    submenu.style.display = 'block';
                } else {
                    hideAllSubmenus();
                }
            });
        });
        
        // 메뉴 호버 이벤트
        navItems.forEach(item => {
            const submenuId = item.getAttribute('data-submenu');
            const submenu = document.getElementById(submenuId);
            
            if (submenuId && submenu) {
                // 마우스 진입 시 서브메뉴 표시
                item.addEventListener('mouseenter', function() {
                    hideAllSubmenus();
                    submenu.style.display = 'block';
                });
                
                // 마우스 이탈 시 서브메뉴 숨기기 (활성화된 탭이 없을 경우)
                item.addEventListener('mouseleave', function(e) {
                    if (!item.classList.contains('active')) {
                        // 마우스가 서브메뉴로 이동했는지 확인
                        const rect = submenu.getBoundingClientRect();
                        const x = e.clientX;
                        const y = e.clientY;
                        
                        // 마우스가 서브메뉴 영역을 향해 이동하는 경우
                        if (y >= rect.top && y <= rect.bottom) {
                            return;
                        }
                        
                        submenu.style.display = 'none';
                    }
                });
            }
        });
        
        // 서브메뉴 호버 이벤트
        submenuWrappers.forEach(submenu => {
            submenu.addEventListener('mouseenter', function() {
                // 서브메뉴에 마우스가 진입하면 표시 유지
            });
            
            submenu.addEventListener('mouseleave', function() {
                // 관련 메뉴가 활성화되어 있지 않으면 서브메뉴 숨기기
                const relatedMenuId = submenu.id;
                const relatedMenu = document.querySelector(`[data-submenu="${relatedMenuId}"]`);
                
                if (relatedMenu && !relatedMenu.classList.contains('active')) {
                    submenu.style.display = 'none';
                }
            });
        });
        
        // 서브메뉴 아이템 클릭 이벤트 (HTML href 직접 사용)
        const submenuItems = document.querySelectorAll('.submenu-item');
        submenuItems.forEach(item => {
            item.addEventListener('click', function(e) {
                const href = this.getAttribute('href');
                
                // href가 비어있거나 "#"인 경우에만 preventDefault (에러 방지)
                if (!href || href === '#' || href === 'javascript:void(0)') {
                    e.preventDefault();
                    console.warn('⚠️ 링크가 설정되지 않은 메뉴 항목:', this.textContent.trim());
                    return;
                }
                
                // 모든 유효한 링크는 HTML href로 직접 이동
                console.log(`🔗 HTML 링크로 이동: ${href}`);
                
                // 서브메뉴 숨기기
                hideAllSubmenus();
                navItems.forEach(nav => nav.classList.remove('active'));
                
                // 기본 링크 동작 허용 (href로 이동)
            });
        });

        // 다른 곳 클릭 시 서브메뉴 닫기
        document.addEventListener('click', function(e) {
            const isMenu = e.target.closest('nav li');
            const isSubmenu = e.target.closest('.submenu-wrapper');
            
            if (!isMenu && !isSubmenu) {
                navItems.forEach(item => item.classList.remove('active'));
                hideAllSubmenus();
            }
        });

        console.log(`✅ 메뉴바 초기화 완료 (${navItems.length}개 메뉴, ${submenuWrappers.length}개 서브메뉴)`);
        return true;
        
    } catch (error) {
        console.error('❌ 메뉴바 초기화 실패:', error);
        return false;
    }
}

// === 🔧 기타 UI 기능들 ===
function initializeOtherFeatures() {
    try {
        // 로고 클릭시 메인페이지로 이동
        const logo = document.querySelector('.logo');
        if(logo) {
            logo.addEventListener('click', function() {
                window.location.href = 'mainpage.html';
            });
        }
        
        // 페이지 로드 시 활성 탭 설정
        function setActiveTab() {
            // 기본적으로 아무 탭도 활성화하지 않음
        }
        
        setActiveTab();
        
        console.log('✅ 기타 UI 기능 초기화 완료');
        
    } catch (error) {
        console.error('❌ 기타 UI 기능 초기화 실패:', error);
    }
}

// === 🤖 챗봇 관련 코드 (새로운 API 연동) ===
function initializeChatbot() {
    try {
        const chatbotIcon = document.querySelector('.robot-icon');
        const chatbotModal = document.getElementById('chatbotModal');
        const closeButton = document.querySelector('.close-button');
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.querySelector('.send-button');
        const chatbotMessages = document.getElementById('chatbotMessages');
        const suggestionButtons = document.querySelectorAll('.suggestion-btn');
        
        // 챗봇 관련 요소가 없으면 건너뛰기
        if (!chatbotIcon || !chatbotModal) {
            console.log('🤖 챗봇 요소가 없어 챗봇 기능을 건너뜁니다.');
            return;
        }
        
        // 챗봇 상태 관리
        let chatbotState = {
            isLoading: false,
            conversationHistory: [],
            sessionId: `chatbot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
        
        // 현재 시간 가져오기
        function getCurrentTime() {
            const now = new Date();
            let hours = now.getHours();
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            
            hours = hours % 12;
            hours = hours ? hours : 12;
            
            return `${ampm} ${hours}:${minutes}`;
        }
        
        // 로딩 메시지 표시
        function showLoadingMessage() {
            const loadingElement = document.createElement('div');
            loadingElement.classList.add('message', 'bot', 'loading-message');
            loadingElement.id = 'loading-message';
            
            const botAvatar = document.createElement('div');
            botAvatar.classList.add('bot-avatar');
            botAvatar.innerHTML = '<img src="https://raw.githubusercontent.com/moody1317/osbasicproject_4/946d8f24f9c780853862670da370ad174c3def6c/chat.png" alt="챗봇 아바타">';
            
            const messageContent = document.createElement('div');
            messageContent.classList.add('message-content');
            messageContent.innerHTML = '<p>답변을 생성하고 있습니다...</p>';
            
            loadingElement.appendChild(botAvatar);
            loadingElement.appendChild(messageContent);
            
            chatbotMessages.appendChild(loadingElement);
            chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
        }
        
        // 로딩 메시지 제거
        function removeLoadingMessage() {
            const loadingMessage = document.getElementById('loading-message');
            if (loadingMessage) {
                loadingMessage.remove();
            }
        }
        
        // 사용자 메시지 추가
        function addUserMessage(message) {
            const messageElement = document.createElement('div');
            messageElement.classList.add('message', 'user');
            
            const timestamp = document.createElement('div');
            timestamp.classList.add('timestamp');
            timestamp.textContent = getCurrentTime();
            
            messageElement.innerHTML = `${message}`;
            messageElement.appendChild(timestamp);
            
            chatbotMessages.appendChild(messageElement);
            chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
        }
        
        // 챗봇 메시지 추가
        function addBotMessage(messages, buttons = []) {
            const messageElement = document.createElement('div');
            messageElement.classList.add('message', 'bot');
            
            const botAvatar = document.createElement('div');
            botAvatar.classList.add('bot-avatar');
            botAvatar.innerHTML = '<img src="https://raw.githubusercontent.com/moody1317/osbasicproject_4/946d8f24f9c780853862670da370ad174c3def6c/chat.png" alt="챗봇 아바타">';
            
            const messageContent = document.createElement('div');
            messageContent.classList.add('message-content');
            
            // 메시지 내용 추가
            if (typeof messages === 'string') {
                messageContent.innerHTML = `<p>${messages}</p>`;
            } else if (Array.isArray(messages)) {
                messages.forEach(msg => {
                    messageContent.innerHTML += `<p>${msg}</p>`;
                });
            }
            
            // 타임스탬프 추가
            const timestamp = document.createElement('div');
            timestamp.classList.add('timestamp');
            timestamp.textContent = getCurrentTime();
            messageContent.appendChild(timestamp);
            
            messageElement.appendChild(botAvatar);
            messageElement.appendChild(messageContent);
            
            chatbotMessages.appendChild(messageElement);
            chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
        }
        
        // 메시지 처리 (새로운 API 사용)
        async function handleMessage(message) {
            // 사용자 메시지 표시
            addUserMessage(message);
            
            // 대화 기록에 추가
            chatbotState.conversationHistory.push({
                role: 'user',
                content: message,
                timestamp: new Date().toISOString()
            });
            
            // 로딩 상태 설정
            chatbotState.isLoading = true;
            showLoadingMessage();
            
            try {
                // 새로운 APIService 사용
                if (window.APIService && typeof window.APIService.sendChatbotMessage === 'function') {
                    console.log('[Chatbot] 새로운 API 호출 중...', message);
                    
                    const options = {
                        sessionId: chatbotState.sessionId,
                        conversationHistory: chatbotState.conversationHistory
                    };
                    
                    const response = await window.APIService.sendChatbotMessage(message, options);
                    
                    removeLoadingMessage();
                    
                    // 응답 처리
                    if (response) {
                        let botResponse = '';
                        
                        // 응답 구조에 따른 처리
                        if (typeof response === 'string') {
                            botResponse = response;
                        } else if (response.response) {
                            botResponse = response.response;
                        } else if (response.userMessage && response.botResponse) {
                            botResponse = response.botResponse;
                        } else if (response.data && response.data.response) {
                            botResponse = response.data.response;
                        } else {
                            botResponse = JSON.stringify(response);
                        }
                        
                        addBotMessage(botResponse);
                        
                        chatbotState.conversationHistory.push({
                            role: 'assistant',
                            content: botResponse,
                            timestamp: new Date().toISOString()
                        });
                        
                        console.log('[Chatbot] ✅ 응답 성공:', response);
                    } else {
                        throw new Error('빈 응답을 받았습니다.');
                    }
                    
                } else {
                    throw new Error('APIService의 sendChatbotMessage 함수를 사용할 수 없습니다.');
                }
                
            } catch (error) {
                console.warn('[Chatbot] ⚠️ API 연결 실패, 기본 응답 사용:', error.message);
                
                removeLoadingMessage();
                
                // 폴백 응답 (API 없이도 작동)
                handleFallbackResponse(message);
            } finally {
                chatbotState.isLoading = false;
            }
        }
        
        // 폴백 응답 처리 (API 실패 시)
        function handleFallbackResponse(message) {
            setTimeout(() => {
                const lowercaseMessage = message.toLowerCase();
                
                if (lowercaseMessage.includes('나경원') || lowercaseMessage.includes('의원')) {
                    addBotMessage([
                        '나경원 의원에 대한 정보입니다.',
                        '현재 나경원 의원은 국민의힘 소속 의원으로 전체 순위를 확인하려면 랭킹 페이지를 방문해주세요.',
                        '나경원 의원에 대한 어떤 정보를 더 얻고싶은가요?'
                    ]);
                } else if (lowercaseMessage.includes('상세') || lowercaseMessage.includes('퍼센트')) {
                    addBotMessage([
                        '의원의 상세 퍼센트 정보를 확인하려면:',
                        '1. 메뉴에서 "랭킹" → "국회의원" 을 선택하세요',
                        '2. 원하는 의원의 "상세보기" 버튼을 클릭하세요',
                        '3. 상세 페이지에서 각종 활동 지표를 확인할 수 있습니다'
                    ]);
                } else if (lowercaseMessage.includes('표결') || lowercaseMessage.includes('정보')) {
                    addBotMessage([
                        '표결 정보를 확인하려면:',
                        '1. "본회의" 메뉴를 통해 각종 법안과 표결 현황을 확인할 수 있습니다',
                        '2. 의원별 표결 참여율은 랭킹 페이지에서 확인 가능합니다'
                    ]);
                } else if (lowercaseMessage.includes('청원') || lowercaseMessage.includes('소개')) {
                    addBotMessage([
                        '청원 관련 정보는:',
                        '1. "청원" 메뉴에서 전체 청원 현황을 확인할 수 있습니다',
                        '2. 의원별 청원 소개 현황은 랭킹 페이지에서 확인 가능합니다'
                    ]);
                } else if (lowercaseMessage.includes('정당') || lowercaseMessage.includes('비교')) {
                    addBotMessage([
                        '정당 관련 기능:',
                        '1. "랭킹" → "정당" 에서 정당별 순위를 확인할 수 있습니다',
                        '2. "비교하기" → "정당 비교" 에서 두 정당을 비교할 수 있습니다',
                        '3. 각 정당의 평균 점수와 상세 통계를 확인하세요'
                    ]);
                } else if (lowercaseMessage.includes('사용법') || lowercaseMessage.includes('도움말')) {
                    addBotMessage([
                        '백일하 사이트 사용법:',
                        '🏆 랭킹: 국회의원과 정당의 활동 순위 확인',
                        '⚖️ 비교하기: 의원 간, 정당 간 비교 분석',
                        '📊 퍼센트: 개별 의원/정당의 상세 활동 지표',
                        '🏛️ 본회의: 국회 본회의 관련 정보',
                        '📝 청원: 국정감사 청원 현황',
                        '',
                        '궁금한 의원명이나 정당명을 입력해보세요!'
                    ]);
                } else {
                    addBotMessage([
                        '죄송합니다. 질문을 이해하지 못했습니다.',
                        '다음 중 어떤 정보를 원하시나요?',
                        '',
                        '🔍 의원명 또는 정당명을 입력해보세요',
                        '📊 "사용법" - 사이트 이용 방법',
                        '🏆 "랭킹" - 순위 확인 방법',
                        '⚖️ "비교" - 비교 기능 안내',
                        '📝 "청원" - 청원 정보 확인',
                        '🏛️ "본회의" - 본회의 정보 확인'
                    ]);
                }
            }, 500);
        }
        
        // 챗봇 이벤트 등록
        if (chatbotIcon) {
            chatbotIcon.addEventListener('click', function() {
                chatbotModal.style.display = 'block';
                
                if (chatbotMessages.children.length === 0) {
                    setTimeout(() => {
                        addBotMessage([
                            '안녕하세요! 백일하 국회의원 정보 챗봇입니다. 🏛️',
                            '',
                            '다음과 같은 정보를 제공해드릴 수 있습니다:',
                            '• 국회의원 및 정당 정보 검색',
                            '• 활동 순위 및 통계 확인',
                            '• 사이트 이용 방법 안내',
                            '',
                            '의원명, 정당명, 또는 궁금한 내용을 입력해 주세요!',
                            '예: "나경원 의원", "더불어민주당", "사용법"'
                        ]);
                    }, 300);
                }
            });
        }
        
        if (closeButton) {
            closeButton.addEventListener('click', function() {
                chatbotModal.style.display = 'none';
            });
        }
        
        if (sendButton && messageInput) {
            sendButton.addEventListener('click', function() {
                const message = messageInput.value.trim();
                if (message && !chatbotState.isLoading) {
                    handleMessage(message);
                    messageInput.value = '';
                }
            });
            
            messageInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    const message = messageInput.value.trim();
                    if (message && !chatbotState.isLoading) {
                        handleMessage(message);
                        messageInput.value = '';
                    }
                }
            });
        }
        
        if (suggestionButtons) {
            suggestionButtons.forEach(button => {
                button.addEventListener('click', function() {
                    const message = this.textContent;
                    if (!chatbotState.isLoading) {
                        handleMessage(message);
                    }
                });
            });
        }
        
        // ESC 키로 모달 닫기
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && chatbotModal && chatbotModal.style.display === 'block') {
                chatbotModal.style.display = 'none';
            }
        });
        
        console.log('✅ 챗봇 기능 초기화 완료 (Django API 연동)');
        
    } catch (error) {
        console.error('❌ 챗봇 초기화 실패:', error);
    }
}

// === 🛠️ 공통 페이지네이션 생성 함수 ===
window.createPagination = function(totalItems, currentPage, itemsPerPage, onPageChange) {
    try {
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const pagination = document.getElementById('pagination');
        
        if (!pagination) {
            console.warn('페이지네이션 컨테이너를 찾을 수 없습니다.');
            return;
        }

        pagination.innerHTML = '';

        if (totalPages <= 1) {
            pagination.style.display = 'none';
            return;
        }

        pagination.style.display = 'flex';

        // 이전 버튼
        if (currentPage > 1) {
            const prevButton = document.createElement('a');
            prevButton.href = '#';
            prevButton.className = 'navigate';
            prevButton.innerHTML = '&lt;';
            prevButton.setAttribute('aria-label', '이전 페이지');
            prevButton.addEventListener('click', (e) => {
                e.preventDefault();
                if (currentPage > 1) {
                    console.log(`페이지 이동: ${currentPage - 1}`);
                    onPageChange(currentPage - 1);
                }
            });
            pagination.appendChild(prevButton);
        }

        // 페이지 번호 계산
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }

        // 첫 페이지
        if (startPage > 1) {
            pagination.appendChild(createPageButton(1, currentPage, onPageChange));
            
            if (startPage > 2) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.className = 'pagination-ellipsis';
                dots.setAttribute('aria-hidden', 'true');
                pagination.appendChild(dots);
            }
        }

        // 페이지 번호들
        for (let i = startPage; i <= endPage; i++) {
            pagination.appendChild(createPageButton(i, currentPage, onPageChange));
        }

        // 마지막 페이지
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.className = 'pagination-ellipsis';
                dots.setAttribute('aria-hidden', 'true');
                pagination.appendChild(dots);
            }
            
            pagination.appendChild(createPageButton(totalPages, currentPage, onPageChange));
        }

        // 다음 버튼
        if (currentPage < totalPages) {
            const nextButton = document.createElement('a');
            nextButton.href = '#';
            nextButton.className = 'navigate';
            nextButton.innerHTML = '&gt;';
            nextButton.setAttribute('aria-label', '다음 페이지');
            nextButton.addEventListener('click', (e) => {
                e.preventDefault();
                if (currentPage < totalPages) {
                    console.log(`페이지 이동: ${currentPage + 1}`);
                    onPageChange(currentPage + 1);
                }
            });
            pagination.appendChild(nextButton);
        }
        
        console.log(`✅ 페이지네이션 생성 완료: ${currentPage}/${totalPages} (총 ${totalItems}개 항목)`);
        
    } catch (error) {
        console.error('❌ 페이지네이션 생성 실패:', error);
    }
};

// 페이지 버튼 생성 헬퍼 함수
function createPageButton(pageNumber, currentPage, onPageChange) {
    const button = document.createElement('a');
    button.href = '#';
    button.textContent = pageNumber;
    button.setAttribute('aria-label', `${pageNumber}페이지로 이동`);
    
    if (pageNumber === currentPage) {
        button.className = 'active';
        button.setAttribute('aria-current', 'page');
    }
    
    button.addEventListener('click', (e) => {
        e.preventDefault();
        if (pageNumber !== currentPage) {
            console.log(`페이지 변경: ${pageNumber}`);
            onPageChange(pageNumber);
        }
    });
    
    return button;
}

// === 🏛️ 정당별 데이터 (전역으로 사용) ===
window.partyData = {
    "국민의힘": {
        url: "https://www.peoplepowerparty.kr/",
        cssPrefix: "ppp"
    },
    "더불어민주당": {
        url: "https://theminjoo.kr/",
        cssPrefix: "dp"
    },
    "조국혁신당": {
        url: "https://rebuildingkoreaparty.kr",
        cssPrefix: "rk"
    },
    "개혁신당": {
        url: "https://www.reformparty.kr/",
        cssPrefix: "reform"
    },
    "진보당": {
        url: "https://jinboparty.com/",
        cssPrefix: "jp"
    },
    "기본소득당": {
        url: "https://basicincomeparty.kr/",
        cssPrefix: "bip"
    },
    "사회민주당": {
        url: "https://www.samindang.kr/",
        cssPrefix: "sdp"
    },
    "무소속": {
        url: "",
        cssPrefix: "ind"
    }
};

// === 🎨 추가 유틸리티 함수들 ===

// 정당별 색상 적용 함수
window.applyPartyColors = function(partyName) {
    try {
        const root = document.documentElement;
        const party = window.partyData[partyName];
        
        if (party && party.cssPrefix) {
            const prefix = party.cssPrefix;
            root.style.setProperty('--current-party-main', `var(--party-${prefix}-main)`);
            root.style.setProperty('--current-party-secondary', `var(--party-${prefix}-secondary)`);
            root.style.setProperty('--current-party-tertiary', `var(--party-${prefix}-tertiary)`);
            root.style.setProperty('--current-party-quaternary', `var(--party-${prefix}-quaternary)`);
            root.style.setProperty('--current-party-quinary', `var(--party-${prefix}-quinary)`);
            root.style.setProperty('--current-party-sixth', `var(--party-${prefix}-sixth)`);
            root.style.setProperty('--current-party-seventh', `var(--party-${prefix}-seventh)`);
            root.style.setProperty('--current-party-eighth', `var(--party-${prefix}-eighth)`);
            root.style.setProperty('--current-party-bg', `var(--party-${prefix}-bg)`);
            
            console.log(`정당 색상 적용: ${partyName} (${prefix})`);
        }
    } catch (error) {
        console.error('정당 색상 적용 실패:', error);
    }
};

// 숫자 포맷팅 함수 (개선된 버전)
window.formatNumber = function(number) {
    try {
        if (number === null || number === undefined) return '0';
        if (typeof number !== 'number') {
            number = parseFloat(number);
        }
        return isNaN(number) ? '0' : number.toLocaleString('ko-KR');
    } catch (error) {
        console.warn('숫자 포맷팅 실패:', error);
        return String(number || '0');
    }
};

// 날짜 포맷팅 함수 (개선된 버전)
window.formatDate = function(dateString) {
    try {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (error) {
        console.warn('날짜 포맷팅 실패:', error);
        return dateString || '';
    }
};

// 퍼센트 포맷팅 함수 (개선된 버전)
window.formatPercent = function(value, decimals = 1) {
    try {
        if (value === null || value === undefined) return '0.0%';
        if (typeof value !== 'number') {
            value = parseFloat(value);
        }
        return isNaN(value) ? '0.0%' : `${value.toFixed(decimals)}%`;
    } catch (error) {
        console.warn('퍼센트 포맷팅 실패:', error);
        return '0.0%';
    }
};

// 디바운스 함수
window.debounce = function(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// API 연결 상태 확인 함수
window.checkAPIStatus = function() {
    try {
        if (typeof window.APIService === 'undefined') {
            return { connected: false, error: 'APIService가 로드되지 않았습니다.' };
        }
        
        if (window.APIService._hasError) {
            return { connected: false, error: 'APIService에 오류가 있습니다.' };
        }
        
        if (!window.APIService._isReady) {
            return { connected: false, error: 'APIService가 준비되지 않았습니다.' };
        }
        
        return { 
            connected: true, 
            version: window.APIService._version || 'unknown',
            config: window.APIService.config ? window.APIService.config.getBaseUrl() : 'unknown'
        };
    } catch (error) {
        return { connected: false, error: error.message };
    }
};

// === 🚀 메인 초기화 함수 ===
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 scripts.js 초기화 시작... (Django API 연동 버전)');
    
    // 1. 메뉴바 초기화 (최우선)
    const menuSuccess = initializeMenuBar();
    
    // 2. 기타 UI 기능 초기화
    initializeOtherFeatures();
    
    // 3. 챗봇 초기화
    initializeChatbot();
    
    // 4. API 서비스 연결 상태 확인 (선택적)
    setTimeout(() => {
        const apiStatus = window.checkAPIStatus();
        
        if (apiStatus.connected) {
            console.log('✅ API 서비스 연결됨');
            console.log(`📡 API 버전: ${apiStatus.version}`);
            console.log(`🔗 서버 주소: ${apiStatus.config}`);
            
            const envInfo = window.APIService.getEnvironmentInfo();
            console.log(`🌍 환경: ${envInfo.isVercel ? 'Vercel 배포' : '로컬 개발'}`);
            
            // 유효한 정당 목록 로그
            if (window.APIService.getValidParties) {
                const validParties = window.APIService.getValidParties();
                console.log(`🏛️ 지원 정당: ${validParties.join(', ')}`);
            }
            
        } else {
            console.warn(`⚠️ API 서비스 연결 실패: ${apiStatus.error}`);
            console.log('ℹ️ 로컬 기능만 사용됩니다.');
        }
        
        // 가중치 동기화 시스템 상태 확인
        if (typeof window.WeightSync !== 'undefined') {
            console.log('🔄 가중치 동기화 시스템 로드됨');
            console.log(`📊 WeightSync 버전: ${window.WeightSync.version}`);
        }
        
    }, 1000);
    
    console.log('✅ scripts.js 초기화 완료');
    console.log(`🎯 메뉴바 상태: ${menuSuccess ? '✅ 성공' : '❌ 실패'}`);
    console.log('🔗 사용 가능한 전역 함수들:');
    console.log('  - window.PercentManager: 퍼센트 설정 관리 (Django API 연동)');
    console.log('  - window.createPagination: 페이지네이션 생성');
    console.log('  - window.applyPartyColors: 정당별 색상 적용');
    console.log('  - window.formatNumber/Date/Percent: 포맷팅 함수들');
    console.log('  - window.partyData: 정당별 정보');
    console.log('  - window.checkAPIStatus: API 연결 상태 확인');
    console.log('📌 서브메뉴: HTML href 속성으로 직접 이동');
    console.log('🤖 챗봇: Django API 연동으로 실시간 응답');
});
