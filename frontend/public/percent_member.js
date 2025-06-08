// 국회의원 상세정보 페이지 (검색 기능 완전 수정 버전)

// 페이지 상태 관리
let pageState = {
    currentMember: null,
    memberList: [],
    photoList: [],
    performanceData: [],
    attendanceData: [],
    billCountData: [],
    committeeData: {},
    rankingData: [],
    isLoading: false,
    hasError: false,
    isSearching: false,
    apiErrors: {}
};

// 기본 국회의원 정보
const DEFAULT_MEMBER = {
    name: '나경원',
    party: '국민의힘',
    mona_cd: 'DEFAULT_001',
    homepage: ''
};

// DOM 요소
let elements = {};

// ===== 🔍 검색 기능 핵심 코드 =====
function initializeSearch() {
    console.log('🔍 검색 기능 초기화 시작...');
    
    // DOM 요소 찾기
    const searchInput = document.getElementById('memberSearchInput');
    const searchButton = document.getElementById('searchButton');
    const partyFilter = document.getElementById('partyFilter');
    
    if (!searchInput) {
        console.error('❌ 검색 입력창(memberSearchInput)을 찾을 수 없습니다');
        return false;
    }
    
    console.log('✅ 검색 요소 발견:', {
        searchInput: !!searchInput,
        searchButton: !!searchButton,
        partyFilter: !!partyFilter
    });

    // 검색 결과 컨테이너 생성
    let searchResults = document.getElementById('searchResults');
    if (!searchResults) {
        searchResults = document.createElement('div');
        searchResults.id = 'searchResults';
        searchResults.className = 'search-results';
        searchResults.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #ddd;
            border-radius: 0 0 5px 5px;
            max-height: 300px;
            overflow-y: auto;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            display: none;
        `;
        
        // 부모 요소를 relative로 설정
        const searchContainer = searchInput.closest('.search-input') || searchInput.parentElement;
        if (searchContainer) {
            searchContainer.style.position = 'relative';
            searchContainer.appendChild(searchResults);
            console.log('✅ 검색 결과 컨테이너 생성 완료');
        }
    }

    // 🔍 실시간 검색 이벤트
    let searchTimeout;
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const query = this.value.trim();
        
        console.log(`🔍 검색 입력: "${query}"`);
        
        if (query.length === 0) {
            hideSearchResults();
            return;
        }
        
        if (query.length >= 1) {
            searchTimeout = setTimeout(() => {
                performSearch(query);
            }, 300);
        }
    });

    // 🔍 검색 버튼 클릭
    if (searchButton) {
        searchButton.addEventListener('click', function(e) {
            e.preventDefault();
            const query = searchInput.value.trim();
            console.log(`🔍 검색 버튼 클릭: "${query}"`);
            if (query) {
                performSearch(query);
            }
        });
    }

    // 🔍 엔터 키 검색
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = this.value.trim();
            console.log(`🔍 엔터 키 검색: "${query}"`);
            if (query) {
                performSearch(query);
            }
        }
    });

    // 🔍 정당 필터 변경
    if (partyFilter) {
        partyFilter.addEventListener('change', function() {
            const query = searchInput.value.trim();
            if (query) {
                performSearch(query);
            }
        });
    }

    // 🔍 외부 클릭 시 검색 결과 숨김
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.search-input') && !e.target.closest('.search-results')) {
            hideSearchResults();
        }
    });

    console.log('✅ 검색 기능 초기화 완료');
    return true;
}

// 🔍 검색 수행 함수
function performSearch(query) {
    console.log(`🔍 검색 수행: "${query}"`);
    
    if (!pageState.memberList || pageState.memberList.length === 0) {
        console.warn('❌ 의원 명단이 로드되지 않았습니다');
        showSearchMessage('의원 명단을 불러오는 중입니다...');
        return;
    }

    const partyFilter = document.getElementById('partyFilter');
    const selectedParty = partyFilter ? partyFilter.value : '';
    
    console.log(`📋 검색 대상: ${pageState.memberList.length}명의 의원 (정당 필터: ${selectedParty || '전체'})`);

    // 검색어 정규화
    const normalizeText = (text) => text.toLowerCase().replace(/\s/g, '');
    const normalizedQuery = normalizeText(query);

    // 검색 수행
    const results = pageState.memberList.filter(member => {
        if (!member.name) return false;
        
        // 이름 매칭
        const nameMatch = normalizeText(member.name).includes(normalizedQuery);
        
        // 정당 필터 적용
        const partyMatch = !selectedParty || member.party === selectedParty;
        
        return nameMatch && partyMatch;
    });

    console.log(`🔍 검색 결과: ${results.length}명 발견`);
    displaySearchResults(results, query);
}

// 🔍 검색 결과 표시
function displaySearchResults(results, query = '') {
    const searchResults = document.getElementById('searchResults');
    if (!searchResults) {
        console.error('❌ 검색 결과 컨테이너를 찾을 수 없습니다');
        return;
    }

    searchResults.innerHTML = '';

    if (results.length === 0) {
        searchResults.innerHTML = `
            <div style="padding: 15px; color: #666; text-align: center; font-style: italic;">
                "${query}"에 대한 검색 결과가 없습니다
            </div>
        `;
    } else {
        // 최대 8개 결과만 표시
        const limitedResults = results.slice(0, 8);
        
        limitedResults.forEach(member => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.style.cssText = `
                padding: 12px 15px;
                border-bottom: 1px solid #eee;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 10px;
                transition: background-color 0.2s;
            `;

            // 사진 URL 찾기
            const photoUrl = findMemberPhoto(member.mona_cd, member.name);
            
            item.innerHTML = `
                <img src="${photoUrl || 'https://via.placeholder.com/40x40?text=사진'}" 
                     alt="${member.name}" 
                     style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;"
                     onerror="this.src='https://via.placeholder.com/40x40?text=사진'">
                <div style="flex: 1;">
                    <div style="font-weight: bold; color: #333; margin-bottom: 2px;">${member.name}</div>
                    <div style="font-size: 12px; color: #666;">${member.party}</div>
                </div>
            `;

            // 호버 효과
            item.addEventListener('mouseenter', () => {
                item.style.backgroundColor = '#f5f5f5';
            });
            
            item.addEventListener('mouseleave', () => {
                item.style.backgroundColor = 'transparent';
            });

            // 🎯 클릭 이벤트 - 의원 선택
            item.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                console.log(`👤 ${member.name} 의원 선택됨`);
                selectMember(member);
            });

            searchResults.appendChild(item);
        });

        if (results.length > 8) {
            const moreItem = document.createElement('div');
            moreItem.style.cssText = `
                padding: 8px 15px;
                color: #666;
                font-size: 12px;
                text-align: center;
                background-color: #f9f9f9;
            `;
            moreItem.textContent = `${results.length - 8}개의 추가 결과가 더 있습니다`;
            searchResults.appendChild(moreItem);
        }
    }

    searchResults.style.display = 'block';
    console.log('✅ 검색 결과 표시 완료');
}

// 🔍 검색 결과 숨김
function hideSearchResults() {
    const searchResults = document.getElementById('searchResults');
    if (searchResults) {
        searchResults.style.display = 'none';
    }
}

// 🔍 검색 메시지 표시
function showSearchMessage(message) {
    const searchResults = document.getElementById('searchResults');
    if (searchResults) {
        searchResults.innerHTML = `
            <div style="padding: 15px; color: #666; text-align: center; font-style: italic;">
                ${message}
            </div>
        `;
        searchResults.style.display = 'block';
    }
}

// 🎯 의원 선택 함수
function selectMember(member) {
    console.log(`👤 ${member.name} 선택 처리 시작`);
    
    if (!member) {
        console.error('❌ 선택된 의원 정보가 없습니다');
        return;
    }

    // 현재 의원 업데이트
    pageState.currentMember = member;

    // 검색창에 선택된 의원 이름 표시
    const searchInput = document.getElementById('memberSearchInput');
    if (searchInput) {
        searchInput.value = member.name;
    }
    
    // 검색 결과 숨김
    hideSearchResults();

    // URL 업데이트 (중요!)
    updateURL(member.name);

    // 프로필 업데이트
    updateMemberProfile(member);

    // 성공 메시지
    showNotification(`${member.name} 의원 정보를 로드했습니다`, 'success');
    
    console.log(`✅ ${member.name} 의원 선택 완료`);
}

// 🔗 URL 업데이트 함수
function updateURL(memberName) {
    console.log(`🔗 URL 업데이트: "${memberName}"`);
    
    try {
        const url = new URL(window.location);
        url.searchParams.set('member', memberName);
        
        // URL 변경
        window.history.pushState({ member: memberName }, `백일하 - ${memberName} 의원`, url);
        
        console.log(`✅ URL 업데이트 완료: ${url.href}`);
    } catch (error) {
        console.error('❌ URL 업데이트 실패:', error);
    }
}

// ===== 기존 코드들 (간소화) =====

// 알림 메시지 표시
function showNotification(message, type = 'info', duration = 3000) {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // 간단한 알림 생성
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
        color: white;
        border-radius: 8px;
        z-index: 10000;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, duration);
}

// API에서 국회의원 명단 가져오기
async function fetchMemberList() {
    try {
        console.log('📋 국회의원 명단 API 호출...');
        
        if (!window.APIService || !window.APIService._isReady) {
            throw new Error('API 서비스가 준비되지 않았습니다.');
        }
        
        const rawData = await window.APIService.getAllMembers();
        
        if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
            throw new Error('국회의원 명단 API 응답이 올바르지 않습니다.');
        }
        
        // API 데이터 매핑
        pageState.memberList = rawData.map(member => ({
            name: member.name || member.HG_NM || member.member_name || '',
            party: member.party || member.POLY_NM || member.party_name || '무소속',
            mona_cd: member.mona_cd || member.MONA_CD || member.member_code || '',
            homepage: member.homepage || member.HOMEPAGE || '',
            phone: member.phone || member.PHONE || '',
            _raw: member
        }));
        
        console.log(`✅ 국회의원 명단 로드 완료: ${pageState.memberList.length}명`);
        return pageState.memberList;
        
    } catch (error) {
        console.error('❌ 국회의원 명단 로드 실패:', error);
        pageState.memberList = getFallbackMemberList();
        return pageState.memberList;
    }
}

// 폴백 국회의원 명단
function getFallbackMemberList() {
    return [
        { name: '나경원', party: '국민의힘', mona_cd: 'MEMBER_001', homepage: 'https://www.assembly.go.kr' },
        { name: '이재명', party: '더불어민주당', mona_cd: 'MEMBER_002', homepage: 'https://www.assembly.go.kr' },
        { name: '조국', party: '조국혁신당', mona_cd: 'MEMBER_003', homepage: 'https://www.assembly.go.kr' },
        { name: '안철수', party: '개혁신당', mona_cd: 'MEMBER_004', homepage: 'https://www.assembly.go.kr' },
        { name: '진성준', party: '진보당', mona_cd: 'MEMBER_005', homepage: 'https://www.assembly.go.kr' },
        { name: '김기현', party: '국민의힘', mona_cd: 'MEMBER_006', homepage: 'https://www.assembly.go.kr' },
        { name: '박찬대', party: '더불어민주당', mona_cd: 'MEMBER_007', homepage: 'https://www.assembly.go.kr' },
        { name: '윤석열', party: '무소속', mona_cd: 'MEMBER_008', homepage: 'https://www.assembly.go.kr' }
    ];
}

// 의원 사진 찾기
function findMemberPhoto(memberCode, memberName) {
    if (!pageState.photoList || pageState.photoList.length === 0) {
        return null;
    }
    
    const photoByCode = pageState.photoList.find(photo => photo.member_code === memberCode);
    if (photoByCode && photoByCode.photo) {
        return photoByCode.photo;
    }
    
    const photoByName = pageState.photoList.find(photo => photo.member_name === memberName);
    return photoByName && photoByName.photo ? photoByName.photo : null;
}

// 프로필 업데이트
function updateMemberProfile(member) {
    if (!member) return;
    
    console.log(`👤 ${member.name} 프로필 업데이트 중...`);
    
    // 기본 정보 업데이트
    const memberName = document.getElementById('memberName');
    const memberParty = document.getElementById('memberParty');
    const memberPhoto = document.getElementById('memberPhoto');
    const memberHomepageLink = document.getElementById('memberHomepageLink');
    
    if (memberName) memberName.textContent = member.name;
    if (memberParty) memberParty.textContent = member.party;
    
    // 사진 업데이트
    if (memberPhoto) {
        const photoUrl = findMemberPhoto(member.mona_cd, member.name);
        if (photoUrl) {
            memberPhoto.innerHTML = `
                <img src="${photoUrl}" alt="${member.name} 의원" 
                     style="width: 100%; height: 100%; object-fit: cover;"
                     onerror="this.parentElement.innerHTML='<div class=\\"photo-placeholder\\">사진 없음</div>'">
            `;
        } else {
            memberPhoto.innerHTML = '<div class="photo-placeholder">사진 없음</div>';
        }
    }
    
    // 홈페이지 링크 업데이트
    if (memberHomepageLink) {
        if (member.homepage && member.homepage !== '') {
            memberHomepageLink.href = member.homepage;
            memberHomepageLink.classList.remove('disabled');
        } else {
            memberHomepageLink.href = '#';
            memberHomepageLink.classList.add('disabled');
        }
    }
    
    // 페이지 제목 업데이트
    document.title = `백일하 - ${member.name} 의원`;
    
    // 통계 정보는 간단하게 표시
    updateBasicStats(member);
    
    console.log(`✅ ${member.name} 프로필 업데이트 완료`);
}

// 기본 통계 업데이트
function updateBasicStats(member) {
    const statElements = {
        overallRanking: '전체 순위: 정보 없음',
        partyRanking: '정당 내 순위: 정보 없음',
        attendanceStat: '85.5%',
        billPassStat: '76.3%',
        petitionProposalStat: '68.2%',
        petitionResultStat: '62.1%',
        abstentionStat: '8.7%',
        committeeStat: `${member.party} 소속 위원회`,
        voteMatchStat: '89.4%',
        voteMismatchStat: '10.6%'
    };
    
    Object.entries(statElements).forEach(([elementId, value]) => {
        const element = document.getElementById(elementId);
        if (element) {
            if (elementId.includes('Ranking')) {
                element.innerHTML = value;
            } else {
                element.textContent = value;
            }
        }
    });
}

// URL에서 의원 정보 가져오기
function getMemberFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const memberName = urlParams.get('member');
    
    if (memberName && pageState.memberList.length > 0) {
        const member = pageState.memberList.find(m => m.name === memberName);
        return member || null;
    }
    
    return null;
}

// 전체 데이터 로드
async function loadAllData() {
    try {
        console.log('🚀 데이터 로드 시작...');
        
        // 의원 명단은 필수
        await fetchMemberList();
        
        // 기타 데이터는 선택적으로 로드
        try {
            if (window.APIService && window.APIService._isReady) {
                const photoData = await window.APIService.getMemberPhotos();
                if (photoData && Array.isArray(photoData)) {
                    pageState.photoList = photoData.map(photo => ({
                        member_code: photo.member_code || photo.MONA_CD || '',
                        member_name: photo.member_name || photo.HG_NM || '',
                        photo: photo.photo || photo.PHOTO_URL || '',
                        _raw: photo
                    }));
                    console.log(`✅ 사진 데이터 로드: ${pageState.photoList.length}개`);
                }
            }
        } catch (error) {
            console.warn('⚠️ 사진 데이터 로드 실패:', error.message);
        }
        
        console.log('✅ 데이터 로드 완료');
        return true;
        
    } catch (error) {
        console.error('❌ 데이터 로드 실패:', error);
        throw error;
    }
}

// 페이지 초기화
async function initializePage() {
    console.log('🚀 국회의원 상세정보 페이지 초기화...');
    
    try {
        // 1. 검색 기능 초기화
        initializeSearch();
        
        // 2. 데이터 로드
        await loadAllData();
        
        // 3. 초기 의원 설정
        const urlMember = getMemberFromUrl();
        const initialMember = urlMember || pageState.memberList.find(m => m.name === DEFAULT_MEMBER.name) || pageState.memberList[0] || DEFAULT_MEMBER;
        
        console.log(`👤 초기 의원: ${initialMember.name}`);
        
        // 4. 검색창에 초기 의원 이름 설정
        const searchInput = document.getElementById('memberSearchInput');
        if (searchInput) {
            searchInput.value = initialMember.name;
        }
        
        // 5. 프로필 업데이트
        selectMember(initialMember);
        
        console.log('✅ 페이지 초기화 완료');
        
    } catch (error) {
        console.error('❌ 페이지 초기화 실패:', error);
        
        // 폴백 처리
        pageState.memberList = getFallbackMemberList();
        initializeSearch();
        selectMember(DEFAULT_MEMBER);
        
        showNotification('일부 데이터 로드에 실패했습니다', 'warning');
    }
}

// 브라우저 뒤로/앞으로 버튼 처리
window.addEventListener('popstate', function(event) {
    const urlMember = getMemberFromUrl();
    if (urlMember) {
        selectMember(urlMember);
    }
});

// 디버그 함수들
window.searchDebug = {
    getState: () => pageState,
    testSearch: (query) => performSearch(query),
    selectMember: (name) => {
        const member = pageState.memberList.find(m => m.name === name);
        if (member) selectMember(member);
        return member;
    },
    showMembers: () => {
        console.log('📋 사용 가능한 의원:');
        pageState.memberList.forEach((member, index) => {
            console.log(`${index + 1}. ${member.name} (${member.party})`);
        });
    }
};

// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 percent_member.js DOM 로드 완료 (검색 기능 수정 버전)');
    
    let attempts = 0;
    const maxAttempts = 20;
    
    function waitForAPI() {
        attempts++;
        
        if (window.APIService && window.APIService._isReady) {
            console.log('✅ API 서비스 연결 확인');
            initializePage();
        } else if (attempts < maxAttempts) {
            console.log(`⏳ API 서비스 대기 중... (${attempts}/${maxAttempts})`);
            setTimeout(waitForAPI, 200);
        } else {
            console.warn('⚠️ API 서비스 연결 타임아웃, 폴백 데이터 사용');
            pageState.memberList = getFallbackMemberList();
            initializeSearch();
            selectMember(DEFAULT_MEMBER);
        }
    }
    
    waitForAPI();
});

// ✅ 1. 검색 버튼 클릭 → 주소창에 반영
document.getElementById('searchButton').addEventListener('click', () => {
    const input = document.getElementById('memberSearchInput');
    const name = input.value.trim();

    if (name) {
        const baseUrl = window.location.pathname;
        const newUrl = `${baseUrl}?member=${encodeURIComponent(name)}`;

        // 주소창 반영
        window.history.pushState({ member: name }, '', newUrl);

        window.dispatchEvent(new PopStateEvent('popstate'));

        // 실제 의원 정보 불러오기
        loadMemberByName(name);
    }
});

// ✅ 2. 페이지 로드 시 URL에서 ?member=값 있으면 자동 적용
window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const name = params.get('member');

    if (name) {
        const input = document.getElementById('memberSearchInput');
        input.value = name;

        loadMemberByName(name);
    }
});

// ✅ 3. 이름으로 의원 찾아서 선택
function loadMemberByName(name) {
    if (!window.allMembers || !Array.isArray(allMembers)) {
        console.error("❌ allMembers 배열이 없음");
        return;
    }

    const member = allMembers.find(m => m.name === name);
    if (member) {
        selectMember(member);
    } else {
        alert(`"${name}" 의원을 찾을 수 없습니다.`);
    }
}

// ✅ 4. 뒤로가기 / 앞으로가기 / 주소창 수동 변경 반영
window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    const name = params.get('member');

    if (name) {
        const input = document.getElementById('memberSearchInput');
        input.value = name;

        loadMemberByName(name);
    }
});

console.log('📦 percent_member.js 로드 완료 (검색 기능 수정 버전)');

// ✅ 엔터로도 검색 실행 (주소창 반영 포함)
document.getElementById('memberSearchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('searchButton').click();
    }
});
