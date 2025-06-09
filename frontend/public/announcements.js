document.addEventListener('DOMContentLoaded', function() {
    // 정적 공지사항 데이터 (Django 연동 없음)
    const announcementData = [
        {
            id: 1,
            date: '2025.06.04',
            title: '제21대 대통령선거 당선으로 인한 의원 안내',
            isNew: true
        },
        {
            id: 2,
            date: '2025.05.26',
            title: '제21대 대통령선거 출마 의원 제외 안내',
            isNew: false
        },
        {
            id: 3,
            date: '2025.05.25',
            title: '국회의원 사진 출처 안내',
            isNew: false
        },
        {
            id: 4,
            date: '2025.01.15',
            title: '서버 점검 안내 (6월 12일 02:00 ~ 06:00)',
            isNew: false
        },
        {
            id: 5,
            date: '2024.04.10',
            title: '제22대 국회의원 정보 업데이트',
            isNew: false
        }
    ];

    // 페이지네이션 설정
    const ITEMS_PER_PAGE = 10;
    let currentPage = 1;

    // 공지사항 목록 렌더링
    function renderAnnouncements(page) {
        const announcementList = document.querySelector('.announcement-list');
        if (!announcementList) return;

        // 페이지에 해당하는 데이터 추출
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const pageData = announcementData.slice(startIndex, endIndex);

        // 기존 내용 초기화
        announcementList.innerHTML = '';

        // 데이터가 없는 경우
        if (pageData.length === 0) {
            announcementList.innerHTML = '<li style="text-align: center; padding: 40px;">공지사항이 없습니다.</li>';
            return;
        }

        // 각 공지사항 렌더링
        pageData.forEach(announcement => {
            const li = document.createElement('li');
            li.innerHTML = `
                <a href="#" data-id="${announcement.id}">
                    <div class="announcement-item">
                        <span class="announcement-date">${announcement.date}</span>
                        <span class="announcement-title">${announcement.title}</span>
                        ${announcement.isNew ? '<span class="announcement-badge new">NEW</span>' : ''}
                    </div>
                </a>
            `;
            announcementList.appendChild(li);
        });

        // 클릭 이벤트 재설정
        setupAnnouncementClickEvents();

        // 페이지네이션 업데이트
        updatePagination();
    }

    // 페이지네이션 업데이트
    function updatePagination() {
        if (window.createPagination) {
            window.createPagination(
                announcementData.length,
                currentPage,
                ITEMS_PER_PAGE,
                (newPage) => {
                    currentPage = newPage;
                    renderAnnouncements(currentPage);
                }
            );
        }
    }

    // 공지사항 클릭 이벤트 설정
    function setupAnnouncementClickEvents() {
        const announcementItems = document.querySelectorAll('.announcement-list a');
        
        announcementItems.forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                
                // 공지사항 정보 가져오기
                const announcementId = this.getAttribute('data-id');
                const title = this.querySelector('.announcement-title').textContent;
                const date = this.querySelector('.announcement-date').textContent;
                
                // 정적 상세 내용 표시
                const content = getStaticAnnouncementContent(title);
                showAnnouncementDetail(title, date, content);
            });
        });
    }

    // 공지사항 상세 내용
    function getStaticAnnouncementContent(title) {
        const contents = {
            '제21대 대통령선거 당선으로 인한 의원 안내': `
                <p style="margin-bottom: 15px;">안녕하세요, 백일하 서비스를 이용해 주시는 여러분께 감사드립니다.</p>
                <p style="margin-bottom: 15px;">2025년 06월 03일에 실시하는 제21대 대통령선거 당선을 진심으로 축하드립니다.</p>
                
                <h4 style="color: var(--string); margin: 20px 0 10px;">더불어민주당</h4>
                <p style="margin-bottom: 15px;">이재명</p>

                <p style="margin-bottom: 15px;">다음 의원의 데이터가 추가되었습니다.</p>
                <h4 style="color: var(--string); margin: 20px 0 10px;">개혁신당</h4>
                <p style="margin-bottom: 15px;">이준석</p>

                <p style="margin-bottom: 15px;">이재명 대통령 당선으로 현재 총 국회의원석은 299명입니다.</p>
            `,
            '제21대 대통령선거 출마 의원 제외 안내': `
                <p style="margin-bottom: 15px;">안녕하세요, 백일하 서비스를 이용해 주시는 여러분께 감사드립니다.</p>
                <p style="margin-bottom: 15px;">2025년 06월 03일에 실시하는 제21대 대통령선거 출마로 다음 의원의 정보가 제외됬었음을 알립니다.</p>
                
                <h4 style="color: var(--string); margin: 20px 0 10px;">더불어민주당</h4>
                <p style="margin-bottom: 15px;">이재명</p>
                <h4 style="color: var(--string); margin: 20px 0 10px;">개혁신당</h4>
                <p style="margin-bottom: 15px;">이준석</p>
            `,
            '국회의원 사진 출처 안내': `
                <p style="margin-bottom: 15px;">안녕하세요, 백일하 서비스를 이용해 주시는 여러분께 감사드립니다.</p>
                <p style="margin-bottom: 15px;">저희가 사용하는 사진들은 각 주소에서 가져왔음을 명시합니다.</p>
                <p style="margin-bottom: 15px;">저희는 어느 정당에 대한 악의가 없으며 비상업적 교육 목적으로 제작되었음을 알립니다.</p>
                
                <h4 style="color: var(--string); margin: 20px 0 10px;">국회의원 사진</h4>
                <p style="margin-bottom: 15px;">열린국회정보 OpenAPI에서 제공하는 국회의원 사진을 사용하였습니다.</p>
            `,
            '서버 점검 안내 (6월 12일 02:00 ~ 06:00)': `
                <p style="margin-bottom: 15px;">안녕하세요, 백일하 서비스를 이용해 주시는 여러분께 감사드립니다.</p>
                <p style="margin-bottom: 15px;">더 나은 서비스 제공을 위한 서버 점검이 예정되어 있어 안내드립니다.</p>
                
                <h4 style="color: var(--light-blue); margin: 20px 0 10px;">점검 일시</h4>
                <p style="margin-bottom: 15px;">2025년 6월 12일 (월) 02:00 ~ 06:00 (약 4시간)</p>
                
                <h4 style="color: var(--light-blue); margin: 20px 0 10px;">점검 내용</h4>
                <ul style="margin-left: 20px; margin-bottom: 15px; line-height: 1.8;">
                    <li>서버 안정성 개선</li>
                    <li>데이터베이스 최적화</li>
                    <li>보안 업데이트</li>
                </ul>
                
                <h4 style="color: var(--light-blue); margin: 20px 0 10px;">참고사항</h4>
                <p>점검 시간 동안은 서비스 이용이 불가능합니다. 불편을 드려 죄송합니다.</p>
            `,
            '제22대 국회의원 정보 업데이트': `
                <p style="margin-bottom: 15px;">제22대 국회의원 정보가 전면 업데이트되었습니다.</p>
    
                <h4 style="color: var(--light-blue); margin: 20px 0 10px;">업데이트 내용</h4>
                <ul style="margin-left: 20px; margin-bottom: 15px; line-height: 1.8;">
                    <li>제22대 국회의원 300명 전원 정보 등록 완료</li>
                    <li>의원별 프로필 사진 및 기본 정보 업데이트</li>
                </ul>
            `
        };
        
        return contents[title] || '<p>공지사항 내용이 준비 중입니다.</p>';
    }

    // 공지사항 상세 모달 표시 함수
    function showAnnouncementDetail(title, date, content) {
        // 기존 모달 제거
        const existingModal = document.querySelector('.announcement-detail-modal');
        const existingBackdrop = document.getElementById('modalBackdrop');
        if (existingModal) existingModal.remove();
        if (existingBackdrop) existingBackdrop.remove();
        
        // 모달 생성
        const modal = document.createElement('div');
        modal.className = 'announcement-detail-modal';
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
            <div style="border-bottom: 1px solid var(--side2); padding-bottom: 15px; margin-bottom: 20px;">
                <h3 style="margin-bottom: 5px; color: var(--string);">${title}</h3>
                <p style="font-size: 14px; color: var(--example);">${date}</p>
            </div>
            <div style="line-height: 1.8; color: var(--string);">
                ${content}
            </div>
            <div style="margin-top: 30px; text-align: center;">
                <button onclick="this.closest('.announcement-detail-modal').remove(); document.getElementById('modalBackdrop').remove();" 
                        style="padding: 10px 30px; background: var(--light-blue); color: white; border: none; border-radius: 5px; cursor: pointer;">
                    확인
                </button>
            </div>
        `;
        
        // 배경 오버레이 생성
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
            modal.remove();
            backdrop.remove();
        };
        
        document.body.appendChild(backdrop);
        document.body.appendChild(modal);
    }
    
    // 페이지 로드 시 애니메이션
    const announcementSection = document.querySelector('.announcement-section');
    if (announcementSection) {
        announcementSection.style.opacity = '0';
        announcementSection.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            announcementSection.style.transition = 'all 0.5s ease';
            announcementSection.style.opacity = '1';
            announcementSection.style.transform = 'translateY(0)';
        }, 100);
    }

    // 즉시 정적 데이터로 렌더링 시작
    console.log('정적 공지사항 로드 시작...');
    renderAnnouncements(currentPage);
    console.log('정적 공지사항 로드 완료:', announcementData.length, '건');
});
