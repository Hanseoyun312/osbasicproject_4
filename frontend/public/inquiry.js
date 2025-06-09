document.addEventListener('DOMContentLoaded', function() {
    // EmailJS 초기화
        emailjs.init({
        publicKey: '2Sb3dCi_Ro8nW0XeK', 
    });
    
    // EmailJS 설정
    const EMAIL_CONFIG = {
        serviceId: 'service_u0mmf8j',    // EmailJS 서비스 ID
        templateId: 'template_eorpjua',  // EmailJS 템플릿 ID
        publicKey: '2Sb3dCi_Ro8nW0XeK'     // EmailJS Public Key
    };
    
    console.log('EmailJS 문의 시스템 초기화 완료');
    
    // 도움말 링크 클릭 이벤트
    const helpLinks = document.querySelectorAll('.help-section ul li a');
    const inquiryLinks = document.querySelectorAll('.inquiry-section ul li a');
    
    // 도움말 링크 처리
    helpLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const linkText = this.textContent.trim();
            
            switch(linkText) {
                case '백일하 서비스 사용법':
                    showUsageGuide();
                    break;
                case '퍼센트 변경':
                    window.location.href = 'percent.html';
                    break;
                default:
                    alert('페이지 준비 중입니다.');
            }
        });
    });
    
    // 문의 링크 처리
    inquiryLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const linkText = this.textContent.trim();
            
            if (linkText === '문의하기') {
                showInquiryForm();
            }
        });
    });
    
    // 백일하 서비스 사용법 표시
    function showUsageGuide() {
        const existingModal = document.querySelector('.help-modal');
        const existingBackdrop = document.getElementById('modalBackdrop');
        if (existingModal) existingModal.remove();
        if (existingBackdrop) existingBackdrop.remove();
        
        const modal = document.createElement('div');
        modal.className = 'help-modal';
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.2);
            z-index: 1000;
            max-width: 700px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        `;
        
        modal.innerHTML = `
            <h3 style="margin-bottom: 20px; color: var(--string);">백일하 서비스 사용법</h3>
            <div style="line-height: 1.8;">
                <h4 style="color: var(--light-blue); margin: 15px 0;">1. 정당 정보 확인</h4>
                <p>• <strong>명예의 정당</strong>: 의정활동 성과가 높은 정당 순위를 확인할 수 있습니다.</p>
                <p>• <strong>정당 상세 퍼센트</strong>: 각 정당의 세부 활동 지표를 파이차트로 확인할 수 있습니다.</p>
                <p>• <strong>정당 비교하기</strong>: 두 정당의 의정활동을 직접 비교할 수 있습니다.</p>
                
                <h4 style="color: var(--light-blue); margin: 15px 0;">2. 국회의원 정보 확인</h4>
                <p>• <strong>국회의원 비교하기</strong>: 두 의원의 활동을 상세히 비교할 수 있습니다.</p>
                <p>• <strong>국회의원 상세정보</strong>: 특정 의원의 모든 의정활동 정보를 확인할 수 있습니다.</p>
                <p>• <strong>명예의 의원</strong>: 의정활동이 우수한 의원들의 순위를 확인할 수 있습니다.</p>
                
                <h4 style="color: var(--light-blue); margin: 15px 0;">3. 의정 활동 확인</h4>
                <p>• <strong>청원 현황</strong>: 국회에 제출된 청원들의 현황과 처리 상태를 확인할 수 있습니다.</p>
                <p>• <strong>본회의 현황</strong>: 본회의에서 처리된 법안들의 정보를 확인할 수 있습니다.</p>
            </div>
            <div style="margin-top: 20px; text-align: right;">
                <button onclick="document.querySelector('.help-modal').remove(); document.getElementById('modalBackdrop').remove();" 
                        style="padding: 10px 20px; background: var(--light-blue); color: white; border: none; border-radius: 5px; cursor: pointer;">
                    닫기
                </button>
            </div>
        `;
        
        const backdrop = createBackdrop();
        document.body.appendChild(backdrop);
        document.body.appendChild(modal);
    }
    
    // EmailJS로 문의하기 폼 표시 및 전송
    function showInquiryForm() {
        // 기존 모달 제거
        const existingModal = document.querySelector('.inquiry-modal');
        const existingBackdrop = document.getElementById('modalBackdrop');
        if (existingModal) existingModal.remove();
        if (existingBackdrop) existingBackdrop.remove();
        
        // 모바일 환경 감지
        const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        const modal = document.createElement('div');
        modal.className = 'inquiry-modal';
        
        if (isMobile) {
            // 모바일용 전체화면 스타일
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: white;
                padding: 15px;
                z-index: 1000;
                overflow-y: auto;
                box-sizing: border-box;
                -webkit-overflow-scrolling: touch;
            `;
        } else {
            // 데스크톱용 중앙 정렬 스타일
            modal.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 5px 20px rgba(0,0,0,0.2);
                z-index: 1000;
                max-width: 500px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
                box-sizing: border-box;
            `;
        }
        
        modal.innerHTML = `
            <div style="position: relative; height: 100%;">
                ${isMobile ? '<button onclick="this.closest(\'.inquiry-modal\').remove(); document.getElementById(\'modalBackdrop\')?.remove(); document.body.style.overflow = \'\';" style="position: absolute; top: 0; right: 0; background: none; border: none; font-size: 24px; cursor: pointer; padding: 5px; z-index: 1001;">×</button>' : ''}
                <h3 style="margin-bottom: 20px; color: var(--string); ${isMobile ? 'margin-top: 30px;' : ''}">📧 문의하기</h3>
                <p style="margin-bottom: 20px; color: var(--example); font-size: 14px;">
                    문의사항을 작성해주시면 이메일로 답변드리겠습니다.
                </p>
                <form id="inquiryForm" style="height: ${isMobile ? 'calc(100% - 100px)' : 'auto'}; display: flex; flex-direction: column;">
                    <div style="flex: 1; overflow-y: auto;">
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 500;">이메일 <span style="color: red;">*</span></label>
                            <input type="email" name="user_email" id="user_email" 
                                   style="width: 100%; padding: 10px; border: 1px solid var(--side2); border-radius: 5px; box-sizing: border-box;" 
                                   required placeholder="답변받을 이메일 주소">
                        </div>
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 500;">문의 유형 <span style="color: red;">*</span></label>
                            <select name="inquiry_type" id="inquiry_type" 
                                    style="width: 100%; padding: 10px; border: 1px solid var(--side2); border-radius: 5px; box-sizing: border-box;" 
                                    required>
                                <option value="">선택해주세요</option>
                                <option value="usage">사용법 문의</option>
                                <option value="error">오류 신고</option>
                                <option value="suggestion">개선 제안</option>
                                <option value="data">데이터 문의</option>
                                <option value="feature">기능 요청</option>
                                <option value="other">기타</option>
                            </select>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 500;">제목 <span style="color: red;">*</span></label>
                            <input type="text" name="subject" id="subject" 
                                   style="width: 100%; padding: 10px; border: 1px solid var(--side2); border-radius: 5px; box-sizing: border-box;" 
                                   required placeholder="문의 제목을 입력해주세요">
                        </div>
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 500;">문의 내용 <span style="color: red;">*</span></label>
                            <textarea name="message" id="message" 
                                      style="width: 100%; padding: 10px; border: 1px solid var(--side2); border-radius: 5px; min-height: ${isMobile ? '120px' : '150px'}; resize: vertical; box-sizing: border-box;" 
                                      required placeholder="문의하실 내용을 자세히 입력해주세요&#10;&#10;예시:&#10;- 어떤 페이지에서 문제가 발생했나요?&#10;- 어떤 기능을 원하시나요?&#10;- 개선사항이 있다면 알려주세요"></textarea>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 500;">파일 첨부 <span style="color: var(--example); font-size: 12px;">(선택사항)</span></label>
                            <div style="position: relative;">
                                <input type="file" name="attachment" id="attachment" 
                                       accept="image/*,.pdf,.doc,.docx,.txt"
                                       style="width: 100%; padding: 10px; border: 1px solid var(--side2); border-radius: 5px; box-sizing: border-box; cursor: pointer;"
                                       multiple>
                                <div style="margin-top: 5px; font-size: 11px; color: var(--example);">
                                    📎 스크린샷, 에러 화면, 문서 등을 첨부하세요 (최대 5MB, 5개 파일)
                                </div>
                            </div>
                            <div id="filePreview" style="margin-top: 10px; display: none;"></div>
                        </div>
                        <div style="margin-bottom: 20px; padding: 10px; background-color: #f8f9fa; border-radius: 5px; font-size: 12px; color: #666;">
                            💡 <strong>팁:</strong> 구체적인 정보(브라우저, OS, 에러 메시지 등)를 함께 작성해주시면 더 정확한 답변을 드릴 수 있습니다.
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: flex-end; padding-top: 10px; border-top: 1px solid #eee; background: white;">
                        ${!isMobile ? `<button type="button" onclick="this.closest('.inquiry-modal').remove(); document.getElementById('modalBackdrop')?.remove(); document.body.style.overflow = '';"
                                style="padding: 10px 20px; border: 1px solid var(--side2); background: white; border-radius: 5px; cursor: pointer;">
                            취소
                        </button>` : ''}
                        <button type="submit" id="submitBtn"
                                style="padding: 10px 20px; background: var(--light-blue); color: white; border: none; border-radius: 5px; cursor: pointer;">
                            📧 전송
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        const backdrop = createBackdrop();
        document.body.appendChild(backdrop);
        document.body.appendChild(modal);
        
        // 모바일에서 스크롤 방지
        if (isMobile) {
            document.body.style.overflow = 'hidden';
            modal.addEventListener('remove', () => {
                document.body.style.overflow = '';
            });
        }
        
        // 파일 첨부 기능 추가
        document.getElementById('attachment').onchange = function(e) {
            const files = Array.from(e.target.files);
            const filePreview = document.getElementById('filePreview');
            const maxSize = 5 * 1024 * 1024; // 5MB
            const maxFiles = 5;
            
            // 파일 개수 체크
            if (files.length > maxFiles) {
                alert(`최대 ${maxFiles}개의 파일만 첨부할 수 있습니다.`);
                e.target.value = '';
                filePreview.style.display = 'none';
                return;
            }
            
            // 파일 크기 체크
            const oversizedFiles = files.filter(file => file.size > maxSize);
            if (oversizedFiles.length > 0) {
                alert(`파일 크기는 5MB를 초과할 수 없습니다.\\n초과된 파일: ${oversizedFiles.map(f => f.name).join(', ')}`);
                e.target.value = '';
                filePreview.style.display = 'none';
                return;
            }
            
            // 파일 미리보기 생성
            if (files.length > 0) {
                filePreview.style.display = 'block';
                filePreview.innerHTML = files.map((file, index) => {
                    const isImage = file.type.startsWith('image/');
                    const fileSize = (file.size / 1024).toFixed(1);
                    
                    return `
                        <div style="display: flex; align-items: center; gap: 10px; padding: 8px; background: #f8f9fa; border-radius: 4px; margin-bottom: 5px; font-size: 12px;">
                            <span style="font-size: 16px;">${isImage ? '🖼️' : '📄'}</span>
                            <div style="flex: 1;">
                                <div style="font-weight: 500; color: var(--string);">${file.name}</div>
                                <div style="color: var(--example);">${fileSize}KB • ${file.type || '알 수 없는 형식'}</div>
                            </div>
                            <button type="button" onclick="removeFile(${index})" 
                                    style="background: none; border: none; color: #dc3545; cursor: pointer; font-size: 14px; padding: 2px;">
                                ×
                            </button>
                        </div>
                    `;
                }).join('');
                
                // 파일 제거 함수 전역으로 설정
                window.removeFile = function(index) {
                    const dt = new DataTransfer();
                    const input = document.getElementById('attachment');
                    const files = Array.from(input.files);
                    
                    files.forEach((file, i) => {
                        if (i !== index) dt.items.add(file);
                    });
                    
                    input.files = dt.files;
                    input.dispatchEvent(new Event('change'));
                };
            } else {
                filePreview.style.display = 'none';
            }
        };
        
        // 문의 유형 변경 시 제목 자동 설정
        document.getElementById('inquiry_type').onchange = function() {
            const subject = document.getElementById('subject');
            const type = this.value;
            const typeMap = {
                'usage': '[사용법 문의] ',
                'error': '[오류 신고] ',
                'suggestion': '[개선 제안] ',
                'data': '[데이터 문의] ',
                'feature': '[기능 요청] ',
                'other': '[기타 문의] '
            };
            
            if (typeMap[type] && !subject.value.startsWith('[')) {
                subject.value = typeMap[type];
                subject.focus();
                subject.setSelectionRange(typeMap[type].length, typeMap[type].length);
            }
        };
        
        // EmailJS로 폼 제출 처리
        document.getElementById('inquiryForm').onsubmit = async function(e) {
            e.preventDefault();
            
            const submitBtn = document.getElementById('submitBtn');
            const originalText = submitBtn.textContent;
            
            // 전송 중 상태
            submitBtn.disabled = true;
            submitBtn.innerHTML = '📤 전송 중...';
            submitBtn.style.background = '#95a5a6';
            
            // 폼 데이터 수집
            const formData = {
                user_email: document.getElementById('user_email').value.trim(),
                inquiry_type: document.getElementById('inquiry_type').value,
                subject: document.getElementById('subject').value.trim(),
                message: document.getElementById('message').value.trim(),
                date: new Date().toLocaleString('ko-KR'),
                timestamp: new Date().toISOString(),
                user_agent: navigator.userAgent
            };
            
            // 첨부 파일 처리
            const attachmentFiles = document.getElementById('attachment').files;
            const attachmentInfo = [];
            
            if (attachmentFiles.length > 0) {
                for (let i = 0; i < attachmentFiles.length; i++) {
                    const file = attachmentFiles[i];
                    attachmentInfo.push({
                        name: file.name,
                        size: (file.size / 1024).toFixed(1) + 'KB',
                        type: file.type || '알 수 없는 형식'
                    });
                }
                formData.attachments = attachmentInfo;
            }
            
            try {
                // EmailJS로 이메일 전송
                console.log('EmailJS로 문의 이메일 전송 중...');
                
                // 첨부파일 정보를 텍스트로 변환
                let attachmentText = '';
                if (formData.attachments && formData.attachments.length > 0) {
                    attachmentText = '\\n\\n📎 첨부된 파일:\\n' + 
                        formData.attachments.map(file => 
                            `- ${file.name} (${file.size}, ${file.type})`
                        ).join('\\n');
                }
                
                const result = await emailjs.send(
                    EMAIL_CONFIG.serviceId,
                    EMAIL_CONFIG.templateId,
                    {
                        from_email: formData.user_email,
                        inquiry_type: getInquiryTypeText(formData.inquiry_type),
                        subject: formData.subject,
                        message: formData.message + attachmentText,
                        date: formData.date,
                        user_agent: formData.user_agent,
                        has_attachments: formData.attachments ? 'yes' : 'no',
                        attachment_count: formData.attachments ? formData.attachments.length : 0
                    },
                    EMAIL_CONFIG.publicKey
                );
                
                console.log('EmailJS 전송 성공:', result);
                
                // 성공 처리
                modal.remove();
                if (existingBackdrop) existingBackdrop.remove();
                if (isMobile) document.body.style.overflow = '';
                const attachmentMsg = formData.attachments && formData.attachments.length > 0 
                    ? `첨부파일 ${formData.attachments.length}개와 함께 ` 
                    : '';
                showSuccessMessage(
                    '문의가 성공적으로 전송되었습니다!',
                    `${attachmentMsg}빠른 시일 내에 ${formData.user_email}로 답변드리겠습니다.`
                );
                
                // 성공 로그 기록
                logInquiry('success', formData);
                
            } catch (error) {
                console.error('EmailJS 전송 실패:', error);
                
                // 에러 처리
                let errorMessage = '문의 전송 중 오류가 발생했습니다.';
                
                if (error.status === 422) {
                    errorMessage = '입력 정보에 오류가 있습니다. 다시 확인해주세요.';
                } else if (error.status === 400) {
                    errorMessage = 'EmailJS 설정에 문제가 있습니다. 관리자에게 문의하세요.';
                } else if (!navigator.onLine) {
                    errorMessage = '인터넷 연결을 확인해주세요.';
                }
                
                // 로컬 저장소에 백업 (유일한 백업 방법)
                saveInquiryToLocalStorage(formData);
                
                modal.remove();
                if (existingBackdrop) existingBackdrop.remove();
                if (isMobile) document.body.style.overflow = '';
                showErrorMessage(
                    errorMessage, 
                    '문의 내용은 임시 저장되었습니다. 인터넷 연결 후 다시 시도해주세요.'
                );
                
                // 에러 로그 기록
                logInquiry('error', formData, error);
                
            } finally {
                // 버튼 상태 복원
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
                submitBtn.style.background = '';
            }
        };
    }
    
    // 문의 유형 텍스트 변환
    function getInquiryTypeText(type) {
        const typeMap = {
            'usage': '사용법 문의',
            'error': '오류 신고',
            'suggestion': '개선 제안',
            'data': '데이터 문의',
            'feature': '기능 요청',
            'other': '기타'
        };
        return typeMap[type] || type;
    }
    
    // 로컬 저장소에 문의 백업 (EmailJS 실패 시 유일한 백업)
    function saveInquiryToLocalStorage(data) {
        try {
            const inquiries = JSON.parse(localStorage.getItem('backup_inquiries') || '[]');
            inquiries.push({
                id: Date.now(),
                ...data,
                status: 'pending',
                created_at: new Date().toISOString()
            });
            
            // 최대 10개까지만 저장
            if (inquiries.length > 10) {
                inquiries.splice(0, inquiries.length - 10);
            }
            
            localStorage.setItem('backup_inquiries', JSON.stringify(inquiries));
            console.log('문의가 로컬 저장소에 백업되었습니다.');
        } catch (error) {
            console.error('로컬 저장소 백업 실패:', error);
        }
    }
    
    // 문의 로그 기록
    function logInquiry(status, data, error = null) {
        const log = {
            timestamp: new Date().toISOString(),
            status: status,
            inquiry_type: data.inquiry_type,
            subject: data.subject,
            email: data.user_email,
            error: error ? {
                message: error.message,
                status: error.status,
                text: error.text
            } : null
        };
        
        console.log('문의 로그:', log);
    }
    
    // 배경 오버레이 생성
    function createBackdrop() {
        const backdrop = document.createElement('div');
        backdrop.id = 'modalBackdrop';
        backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 999;
        `;
        
        backdrop.onclick = function() {
            const modal = document.querySelector('.help-modal, .inquiry-modal');
            if (modal) {
                modal.remove();
                document.body.style.overflow = '';
            }
            backdrop.remove();
        };
        
        return backdrop;
    }
    
    // 성공 메시지 표시
    function showSuccessMessage(title = '문의가 전송되었습니다!', subtitle = '빠른 시일 내에 답변드리겠습니다.') {
        const successModal = document.createElement('div');
        successModal.className = 'success-modal';
        successModal.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: white;
            padding: 20px 30px;
            border-radius: 15px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.15);
            z-index: 1001;
            text-align: center;
            display: flex;
            align-items: center;
            gap: 15px;
            max-width: 400px;
            border-left: 4px solid #4CAF50;
        `;
        
        successModal.innerHTML = `
            <div style="color: #4CAF50; font-size: 30px;">✓</div>
            <div style="text-align: left;">
                <h4 style="margin: 0 0 5px 0; color: var(--string); font-size: 16px;">${title}</h4>
                <p style="margin: 0; color: var(--example); font-size: 14px;">${subtitle}</p>
            </div>
            <button onclick="this.parentElement.remove()" 
                    style="background: none; border: none; font-size: 20px; cursor: pointer; color: var(--example); margin-left: 10px;">
                ×
            </button>
        `;
        
        document.body.appendChild(successModal);
        
        // 7초 후 자동 제거
        setTimeout(() => {
            if (successModal.parentElement) {
                successModal.remove();
            }
        }, 7000);
    }
    
    // 에러 메시지 표시
    function showErrorMessage(title, subtitle = '나중에 다시 시도해주세요.') {
        const errorModal = document.createElement('div');
        errorModal.className = 'error-modal';
        errorModal.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: white;
            padding: 20px 30px;
            border-radius: 15px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.15);
            z-index: 1001;
            text-align: center;
            display: flex;
            align-items: center;
            gap: 15px;
            max-width: 400px;
            border-left: 4px solid #f44336;
        `;
        
        errorModal.innerHTML = `
            <div style="color: #f44336; font-size: 30px;">⚠</div>
            <div style="text-align: left;">
                <h4 style="margin: 0 0 5px 0; color: var(--string); font-size: 16px;">${title}</h4>
                <p style="margin: 0; color: var(--example); font-size: 14px;">${subtitle}</p>
            </div>
            <button onclick="this.parentElement.remove()" 
                    style="background: none; border: none; font-size: 20px; cursor: pointer; color: var(--example); margin-left: 10px;">
                ×
            </button>
        `;
        
        document.body.appendChild(errorModal);
        
        // 8초 후 자동 제거
        setTimeout(() => {
            if (errorModal.parentElement) {
                errorModal.remove();
            }
        }, 8000);
    }
    
    // 페이지 로드 시 애니메이션 효과
    const sections = document.querySelectorAll('.help-section, .inquiry-section');
    sections.forEach((section, index) => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            section.style.transition = 'all 0.5s ease';
            section.style.opacity = '1';
            section.style.transform = 'translateY(0)';
        }, index * 200);
    });
    
    // EmailJS 상태 확인
    function checkEmailJSStatus() {
        if (typeof emailjs === 'undefined') {
            console.error('EmailJS 라이브러리가 로드되지 않았습니다.');
            return false;
        }
        
        if (!EMAIL_CONFIG.serviceId || !EMAIL_CONFIG.templateId || !EMAIL_CONFIG.publicKey) {
            console.error('EmailJS 설정이 완료되지 않았습니다.');
            return false;
        }
        
        return true;
    }
    
    // 페이지 로드 시 EmailJS 상태 확인
    setTimeout(() => {
        if (checkEmailJSStatus()) {
            console.log('✅ EmailJS 문의 시스템 준비 완료');
        } else {
            console.warn('⚠️ EmailJS 설정 확인 필요');
        }
    }, 1000);
    
    // 백업된 문의 확인 및 표시 (개발자 도구용)
    window.showBackupInquiries = function() {
        const backupInquiries = JSON.parse(localStorage.getItem('backup_inquiries') || '[]');
        console.log('백업된 문의 목록:', backupInquiries);
        return backupInquiries;
    };
    
    // 백업된 문의 삭제 (개발자 도구용)
    window.clearBackupInquiries = function() {
        localStorage.removeItem('backup_inquiries');
        console.log('백업된 문의가 삭제되었습니다.');
    };
});
