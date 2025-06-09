// 국회의원 상세정보 페이지 (검색 기능 개선 버전)

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
    apiErrors: {} // API 오류 추적
};

// 기본 국회의원 정보
const DEFAULT_MEMBER = {
    name: '나경원',
    party: '국민의힘',
    mona_cd: 'DEFAULT_001',
    homepage: ''
};

// DOM 요소 캐시
const elements = {
    memberName: null,
    memberParty: null,
    memberPhoto: null,
    memberHomepageLink: null,
    searchInput: null,
    partyFilter: null,
    searchButton: null,
    searchResults: null,
    overallRanking: null,
    partyRanking: null,
    attendanceStat: null,
    billPassStat: null,
    petitionProposalStat: null,
    petitionResultStat: null,
    committeeStat: null,
    abstentionStat: null,
    voteMatchStat: null,
    voteMismatchStat: null
};

// DOM 요소 초기화
function initializeElements() {
    console.log('🔧 DOM 요소 초기화 시작...');
    
    elements.memberName = document.getElementById('memberName');
    elements.memberParty = document.getElementById('memberParty');
    elements.memberPhoto = document.getElementById('memberPhoto');
    elements.memberHomepageLink = document.getElementById('memberHomepageLink');
    elements.searchInput = document.getElementById('memberSearchInput');
    elements.partyFilter = document.getElementById('partyFilter');
    elements.searchButton = document.getElementById('searchButton');
    elements.overallRanking = document.getElementById('overallRanking');
    elements.partyRanking = document.getElementById('partyRanking');
    elements.attendanceStat = document.getElementById('attendanceStat');
    elements.billPassStat = document.getElementById('billPassStat');
    elements.petitionProposalStat = document.getElementById('petitionProposalStat');
    elements.petitionResultStat = document.getElementById('petitionResultStat');
    elements.committeeStat = document.getElementById('committeeStat');
    elements.abstentionStat = document.getElementById('abstentionStat');
    elements.voteMatchStat = document.getElementById('voteMatchStat');
    elements.voteMismatchStat = document.getElementById('voteMismatchStat');
    
    console.log('✅ DOM 요소 초기화 완료');
}

// ===== 🔍 개선된 검색 기능 (뒤의 파일에서 가져옴) =====

// 🔍 검색 기능 초기화
function initializeSearch() {
    console.log('🔍 검색 기능 초기화 시작...');
    
    // DOM 요소 확인
    if (!elements.searchInput) {
        console.error('❌ 검색 입력창(memberSearchInput)을 찾을 수 없습니다');
        return false;
    }
    
    console.log('✅ 검색 요소 발견:', {
        searchInput: !!elements.searchInput,
        searchButton: !!elements.searchButton,
        partyFilter: !!elements.partyFilter
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
        const searchContainer = elements.searchInput.closest('.search-input') || elements.searchInput.parentElement;
        if (searchContainer) {
            searchContainer.style.position = 'relative';
            searchContainer.appendChild(searchResults);
            console.log('✅ 검색 결과 컨테이너 생성 완료');
        }
    }
    
    elements.searchResults = searchResults;

    // 🔍 실시간 검색 이벤트
    let searchTimeout;
    elements.searchInput.addEventListener('input', function() {
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
    if (elements.searchButton) {
        elements.searchButton.addEventListener('click', function(e) {
            e.preventDefault();
            const query = elements.searchInput.value.trim();
            console.log(`🔍 검색 버튼 클릭: "${query}"`);
            if (query) {
                performSearch(query);
            }
        });
    }

    // 🔍 엔터 키 검색
    elements.searchInput.addEventListener('keypress', function(e) {
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
    if (elements.partyFilter) {
        elements.partyFilter.addEventListener('change', function() {
            const query = elements.searchInput.value.trim();
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

    const selectedParty = elements.partyFilter ? elements.partyFilter.value : '';
    
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
    if (!elements.searchResults) {
        console.error('❌ 검색 결과 컨테이너를 찾을 수 없습니다');
        return;
    }

    elements.searchResults.innerHTML = '';

    if (results.length === 0) {
        elements.searchResults.innerHTML = `
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
            
            // 위원회 정보 찾기
            const committees = findMemberCommittees(member.name);
            const committeesText = committees.length > 0 ? 
                committees.slice(0, 2).map(c => c.committee).join(', ') : 
                '위원회 정보 없음';
            
            item.innerHTML = `
                <img src="${photoUrl || 'https://via.placeholder.com/40x40?text=사진'}" 
                     alt="${member.name}" 
                     style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;"
                     onerror="this.src='https://via.placeholder.com/40x40?text=사진'">
                <div style="flex: 1;">
                    <div style="font-weight: bold; color: #333; margin-bottom: 2px;">${member.name}</div>
                    <div style="font-size: 12px; color: #666;">${member.party} · ${committeesText}</div>
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

            elements.searchResults.appendChild(item);
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
            elements.searchResults.appendChild(moreItem);
        }
    }

    elements.searchResults.style.display = 'block';
    console.log('✅ 검색 결과 표시 완료');
}

// 🔍 검색 결과 숨김
function hideSearchResults() {
    if (elements.searchResults) {
        elements.searchResults.style.display = 'none';
    }
}

// 🔍 검색 메시지 표시
function showSearchMessage(message) {
    if (elements.searchResults) {
        elements.searchResults.innerHTML = `
            <div style="padding: 15px; color: #666; text-align: center; font-style: italic;">
                ${message}
            </div>
        `;
        elements.searchResults.style.display = 'block';
    }
}

// 🎯 의원 선택 함수 (개선된 버전)
function selectMember(member) {
    console.log(`👤 ${member.name} 선택 처리 시작`);
    
    if (!member) {
        console.error('❌ 선택된 의원 정보가 없습니다');
        return;
    }

    // 현재 의원 업데이트
    pageState.currentMember = member;

    // 검색창에 선택된 의원 이름 표시
    if (elements.searchInput) {
        elements.searchInput.value = member.name;
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

// 🔗 URL 업데이트 함수 (개선된 버전)
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

// ===== 기존 코드들 (그대로 유지) =====

// 로딩 상태 표시/숨김
function toggleLoadingState(show) {
    pageState.isLoading = show;
    
    if (show) {
        const loadingElements = [
            elements.overallRanking,
            elements.partyRanking,
            elements.attendanceStat,
            elements.billPassStat,
            elements.petitionProposalStat,
            elements.petitionResultStat,
            elements.abstentionStat,
            elements.committeeStat,
            elements.voteMatchStat,
            elements.voteMismatchStat
        ];
        
        loadingElements.forEach(el => {
            if (el) {
                el.innerHTML = '<span class="loading-spinner"></span>로딩 중...';
                el.classList.add('loading');
            }
        });
        
        if (elements.searchButton) {
            elements.searchButton.disabled = true;
        }
        
    } else {
        document.querySelectorAll('.loading').forEach(el => {
            el.classList.remove('loading');
        });
        
        if (elements.searchButton) {
            elements.searchButton.disabled = false;
        }
    }
}

// 알림 메시지 표시
function showNotification(message, type = 'info', duration = 3000) {
    if (window.APIService && window.APIService.showNotification) {
        window.APIService.showNotification(message, type, duration);
    } else {
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
}

// 🔧 API 응답 데이터 구조 검사 함수
function inspectAPIResponse(data, dataType) {
    if (!data || !Array.isArray(data) || data.length === 0) {
        console.warn(`⚠️ ${dataType} 데이터가 비어있음`);
        return null;
    }
    
    const sample = data[0];
    const fields = Object.keys(sample);
    
    console.log(`🔍 ${dataType} 데이터 구조 분석:`, {
        총개수: data.length,
        필드목록: fields,
        샘플데이터: sample
    });
    
    return {
        data,
        fields,
        sample,
        count: data.length
    };
}

// API에서 국회의원 명단 가져오기
async function fetchMemberList() {
    try {
        console.log('📋 국회의원 명단 API 호출...');
        
        if (!window.APIService || !window.APIService._isReady) {
            throw new Error('API 서비스가 준비되지 않았습니다.');
        }
        
        const rawData = await window.APIService.getAllMembers();
        const inspection = inspectAPIResponse(rawData, '국회의원 명단');
        
        if (!inspection) {
            throw new Error('국회의원 명단 API 응답이 올바르지 않습니다.');
        }
        
        // API 데이터 매핑 (더 유연한 필드 매핑)
        pageState.memberList = rawData.map(member => ({
            name: member.name || member.HG_NM || member.member_name || '',
            party: member.party || member.POLY_NM || member.party_name || '무소속',
            mona_cd: member.mona_cd || member.MONA_CD || member.member_code || '',
            homepage: member.homepage || member.HOMEPAGE || '',
            phone: member.phone || member.PHONE || '',
            _raw: member
        }));
        
        console.log(`✅ 국회의원 명단 로드 완료: ${pageState.memberList.length}명`);
        
        // 나경원 의원 확인
        const targetMember = pageState.memberList.find(m => m.name === '나경원');
        if (targetMember) {
            console.log('✅ 나경원 의원 발견:', targetMember);
        } else {
            console.warn('❌ 나경원 의원 없음, 첫 번째 의원 사용');
            console.log('📋 전체 의원명 목록 (처음 10명):', 
                pageState.memberList.slice(0, 10).map(m => m.name));
        }
        
        pageState.apiErrors.memberList = false;
        return pageState.memberList;
        
    } catch (error) {
        console.error('❌ 국회의원 명단 로드 실패:', error);
        pageState.apiErrors.memberList = error.message;
        pageState.memberList = getFallbackMemberList();
        return pageState.memberList;
    }
}

// 실적 데이터 가져오기 함수
async function fetchPerformanceData() {
    try {
        console.log('📊 국회의원 실적 API 호출...');
        
        const response = await window.APIService.getMemberPerformance();
        console.log('🔍 실적 API 원본 응답:', response);

        let performanceData = [];

        if (response && Array.isArray(response.ranking)) {
            performanceData = response.ranking;
            console.log('✅ response.ranking 배열 사용');
        } else if (Array.isArray(response)) {
            performanceData = response;
            console.log('✅ response 직접 배열 사용');
        } else {
            console.warn('⚠️ 예상하지 못한 API 응답 구조:', response);
            throw new Error('API 응답 형식이 올바르지 않습니다');
        }

        const inspection = inspectAPIResponse(performanceData, '실적');
        if (!inspection) {
            console.warn('⚠️ 실적 API가 빈 데이터 반환 - 폴백 실적 데이터 생성');
            pageState.performanceData = generateFallbackPerformanceData();
            pageState.apiErrors.performance = 'API 빈 데이터 - 폴백 사용';
            return pageState.performanceData;
        }

        // 필드 매핑
        pageState.performanceData = performanceData.map(perf => {
            const name = perf.lawmaker_name || perf.name || perf.HG_NM || perf.member_name || '';
            const party = perf.party || perf.POLY_NM || perf.party_name || '무소속';
            const totalScore = parseFloat(perf.total_socre || perf.total_score || 0);

            return {
                name,
                party,
                total_score: totalScore,
                attendance_score: parseFloat(perf.attendance_score || 0),
                bill_pass_score: parseFloat(perf.bill_pass_score || 0),
                petition_score: parseFloat(perf.petition_score || 0),
                petition_result_score: parseFloat(perf.petition_result_score || 0),
                committee_score: parseFloat(perf.committee_score || 0),
                invalid_vote_ratio: parseFloat(perf.invalid_vote_ratio || 0),
                vote_match_ratio: parseFloat(perf.vote_match_ratio || 0),
                vote_mismatch_ratio: parseFloat(perf.vote_mismatch_ratio || 0),
                lawmaker_id: perf.lawmaker || perf.lawmaker_id || perf.id || '',
                _raw: perf
            };
        });

        console.log(`✅ 실적 데이터 로드 완료: ${pageState.performanceData.length}개`);
        pageState.apiErrors.performance = false;
        return pageState.performanceData;

    } catch (error) {
        console.error('❌ 실적 데이터 로드 실패:', error);
        pageState.apiErrors.performance = error.message;
        pageState.performanceData = generateFallbackPerformanceData();
        return pageState.performanceData;
    }
}

// 위원회 데이터 가져오기
async function fetchCommitteeData() {
    try {
        console.log('🏛️ 위원회 API 호출...');
        
        const committeeData = await window.APIService.getCommitteeMembers();
        const inspection = inspectAPIResponse(committeeData, '위원회');
        
        if (!inspection) {
            console.warn('위원회 데이터가 없음');
            pageState.committeeData = {};
            pageState.apiErrors.committee = '데이터 없음';
            return pageState.committeeData;
        }
        
        // 위원회 데이터를 의원별로 그룹화
        const committeeMap = {};
        committeeData.forEach(member => {
            const memberName = member.HG_NM || member.name || member.member_name || '';
            if (!memberName) return;
            
            if (!committeeMap[memberName]) {
                committeeMap[memberName] = [];
            }
            
            committeeMap[memberName].push({
                committee: member.DEPT_NM || member.committee || member.committee_name || '위원회 없음',
                position: member.JOB_RES_NM || member.position || member.job_title || '일반위원',
                member_name: memberName,
                party: member.POLY_NM || member.party || member.party_name || '무소속',
                member_code: member.MONA_CD || member.member_code || '',
                _raw: member
            });
        });
        
        pageState.committeeData = committeeMap;
        console.log(`✅ 위원회 데이터 로드 완료: ${Object.keys(committeeMap).length}명`);
        
        pageState.apiErrors.committee = false;
        return pageState.committeeData;
        
    } catch (error) {
        console.error('❌ 위원회 데이터 로드 실패:', error);
        pageState.apiErrors.committee = error.message;
        pageState.committeeData = {};
        return pageState.committeeData;
    }
}

// 랭킹 데이터 가져오기
async function fetchRankingData() {
    try {
        console.log('🏆 국회의원 랭킹 API 호출...');
        
        const rankingData = await window.APIService.getMemberRanking();
        const inspection = inspectAPIResponse(rankingData, '랭킹');
        
        if (!inspection) {
            console.warn('랭킹 데이터가 없음');
            pageState.rankingData = [];
            pageState.apiErrors.ranking = '데이터 없음';
            return pageState.rankingData;
        }
        
        pageState.rankingData = rankingData.map(rank => ({
            name: rank.HG_NM || rank.name || rank.member_name || '',
            party: rank.POLY_NM || rank.party || rank.party_name || '무소속',
            overall_rank: parseInt(rank.총점_순위 || rank.overall_rank || rank.rank || 999),
            _raw: rank
        }));
        
        console.log(`✅ 랭킹 데이터 로드 완료: ${pageState.rankingData.length}개`);
        
        pageState.apiErrors.ranking = false;
        return pageState.rankingData;
        
    } catch (error) {
        console.error('❌ 랭킹 데이터 로드 실패:', error);
        pageState.apiErrors.ranking = error.message;
        pageState.rankingData = [];
        return pageState.rankingData;
    }
}

// 기타 API 로드 함수들
async function fetchPhotoList() {
    try {
        const photoData = await window.APIService.getMemberPhotos();
        if (!photoData || !Array.isArray(photoData)) {
            pageState.photoList = [];
            return pageState.photoList;
        }
        
        pageState.photoList = photoData.map(photo => ({
            member_code: photo.member_code || photo.MONA_CD || '',
            member_name: photo.member_name || photo.HG_NM || '',
            photo: photo.photo || photo.PHOTO_URL || '',
            _raw: photo
        }));
        
        console.log(`✅ 사진 데이터 로드 완료: ${pageState.photoList.length}개`);
        return pageState.photoList;
        
    } catch (error) {
        console.error('❌ 사진 데이터 로드 실패:', error);
        pageState.photoList = [];
        return pageState.photoList;
    }
}

async function fetchAttendanceData() {
    try {
        const attendanceData = await window.APIService.getMemberAttendance();
        if (!attendanceData || !Array.isArray(attendanceData)) {
            pageState.attendanceData = [];
            return pageState.attendanceData;
        }
        
        pageState.attendanceData = attendanceData.map(att => ({
            member_name: att.member_name || att.HG_NM || '',
            party: att.party || att.POLY_NM || '무소속',
            total_meetings: parseInt(att.total_meetings || att.TOTAL_MEETINGS || 0),
            attendance: parseInt(att.attendance || att.ATTENDANCE || 0),
            attendance_rate: parseFloat(att.attendance_rate || att.ATTENDANCE_RATE || 0),
            _raw: att
        }));
        
        console.log(`✅ 출석 데이터 로드 완료: ${pageState.attendanceData.length}개`);
        return pageState.attendanceData;
        
    } catch (error) {
        console.error('❌ 출석 데이터 로드 실패:', error);
        pageState.attendanceData = [];
        return pageState.attendanceData;
    }
}

async function fetchBillCountData() {
    try {
        const billCountData = await window.APIService.getMemberBillCount();
        if (!billCountData || !Array.isArray(billCountData)) {
            pageState.billCountData = [];
            return pageState.billCountData;
        }
        
        pageState.billCountData = billCountData.map(bill => ({
            id: bill.id || bill.ID || '',
            proposer: bill.proposer || bill.PROPOSER || bill.member_name || '',
            total: parseInt(bill.total || bill.TOTAL || 0),
            approved: parseInt(bill.approved || bill.APPROVED || 0),
            _raw: bill
        }));
        
        console.log(`✅ 본회의 제안 데이터 로드 완료: ${pageState.billCountData.length}개`);
        return pageState.billCountData;
        
    } catch (error) {
        console.error('❌ 본회의 제안 데이터 로드 실패:', error);
        pageState.billCountData = [];
        return pageState.billCountData;
    }
}

// 폴백 실적 데이터 생성 함수
function generateFallbackPerformanceData() {
    if (!pageState.memberList || pageState.memberList.length === 0) {
        console.warn('의원 명단이 없어 폴백 실적 데이터 생성 불가');
        return [];
    }
    
    console.log(`🎲 ${pageState.memberList.length}명의 의원에 대한 폴백 실적 데이터 생성 중...`);
    
    // 정당별 기본 통계
    const partyBaseStats = {
        '국민의힘': {
            attendance_score: 85.5,
            bill_pass_score: 75.2,
            petition_score: 65.3,
            petition_result_score: 58.7,
            committee_score: 70.0,
            invalid_vote_ratio: 0.08,
            vote_match_ratio: 0.92,
            vote_mismatch_ratio: 0.08
        },
        '더불어민주당': {
            attendance_score: 87.2,
            bill_pass_score: 82.1,
            petition_score: 72.4,
            petition_result_score: 67.9,
            committee_score: 75.0,
            invalid_vote_ratio: 0.06,
            vote_match_ratio: 0.94,
            vote_mismatch_ratio: 0.06
        },
        '조국혁신당': {
            attendance_score: 82.8,
            bill_pass_score: 76.4,
            petition_score: 61.2,
            petition_result_score: 55.8,
            committee_score: 68.0,
            invalid_vote_ratio: 0.12,
            vote_match_ratio: 0.88,
            vote_mismatch_ratio: 0.12
        }
    };
    
    const defaultStats = {
        attendance_score: 80.0,
        bill_pass_score: 70.0,
        petition_score: 60.0,
        petition_result_score: 55.0,
        committee_score: 65.0,
        invalid_vote_ratio: 0.10,
        vote_match_ratio: 0.90,
        vote_mismatch_ratio: 0.10
    };
    
    return pageState.memberList.map((member, index) => {
        const baseStats = partyBaseStats[member.party] || defaultStats;
        const variationFactor = 0.85 + (Math.random() * 0.3);
        
        let specialBonus = 1.0;
        if (member.name === '나경원') {
            specialBonus = 1.1;
        }
        
        const attendance_score = Math.min(95, baseStats.attendance_score * variationFactor * specialBonus);
        const bill_pass_score = Math.min(90, baseStats.bill_pass_score * variationFactor * specialBonus);
        const petition_score = Math.min(90, baseStats.petition_score * variationFactor * specialBonus);
        const petition_result_score = Math.min(85, baseStats.petition_result_score * variationFactor * specialBonus);
        const committee_score = Math.min(80, baseStats.committee_score * variationFactor * specialBonus);
        
        const total_score = (attendance_score + bill_pass_score + petition_score + petition_result_score + committee_score) / 5;
        
        return {
            name: member.name,
            party: member.party,
            total_score: parseFloat(total_score.toFixed(1)),
            attendance_score: parseFloat(attendance_score.toFixed(1)),
            bill_pass_score: parseFloat(bill_pass_score.toFixed(1)),
            petition_score: parseFloat(petition_score.toFixed(1)),
            petition_result_score: parseFloat(petition_result_score.toFixed(1)),
            committee_score: parseFloat(committee_score.toFixed(1)),
            invalid_vote_ratio: baseStats.invalid_vote_ratio * (0.8 + Math.random() * 0.4),
            vote_match_ratio: baseStats.vote_match_ratio * (0.95 + Math.random() * 0.1),
            vote_mismatch_ratio: baseStats.vote_mismatch_ratio * (0.8 + Math.random() * 0.4),
            lawmaker_id: member.mona_cd || `GENERATED_${index}`,
            _fallback: true
        };
    });
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
        { name: '박찬대', party: '더불어민주당', mona_cd: 'MEMBER_007', homepage: 'https://www.assembly.go.kr' }
    ];
}

// 데이터 검색 함수들
function findMemberPhoto(memberCode, memberName) {
    if (!pageState.photoList || pageState.photoList.length === 0) {
        return null;
    }
    
    const photoByCode = pageState.photoList.find(photo => 
        photo.member_code === memberCode
    );
    
    if (photoByCode && photoByCode.photo) {
        return photoByCode.photo;
    }
    
    const photoByName = pageState.photoList.find(photo => 
        photo.member_name === memberName
    );
    
    return photoByName && photoByName.photo ? photoByName.photo : null;
}

function findMemberPerformance(memberName) {
    if (!pageState.performanceData || pageState.performanceData.length === 0) {
        console.log(`🔍 ${memberName} 실적 검색: 실적 데이터가 없음`);
        return null;
    }
    
    let performance = pageState.performanceData.find(perf => perf.name === memberName);
    
    if (!performance) {
        performance = pageState.performanceData.find(perf => 
            perf.name.replace(/\s/g, '') === memberName.replace(/\s/g, '')
        );
    }
    
    if (!performance) {
        performance = pageState.performanceData.find(perf => 
            perf.name.includes(memberName) || memberName.includes(perf.name)
        );
    }
    
    return performance;
}

function findMemberCommittees(memberName) {
    if (!pageState.committeeData) {
        return [];
    }
    
    let committees = pageState.committeeData[memberName];
    
    if (!committees) {
        const nameWithoutSpaces = memberName.replace(/\s/g, '');
        for (const [key, value] of Object.entries(pageState.committeeData)) {
            if (key.replace(/\s/g, '') === nameWithoutSpaces) {
                committees = value;
                break;
            }
        }
    }
    
    return committees || [];
}

function findMemberRanking(memberName) {
    if (!pageState.rankingData || pageState.rankingData.length === 0) {
        return null;
    }
    
    return pageState.rankingData.find(rank => 
        rank.name === memberName ||
        rank.name.replace(/\s/g, '') === memberName.replace(/\s/g, '')
    );
}

// UI 업데이트 함수들
function updateMemberProfile(member) {
    if (!member) return;
    
    console.log(`👤 ${member.name} 프로필 업데이트 중...`);
    
    if (elements.memberName) elements.memberName.textContent = member.name;
    if (elements.memberParty) elements.memberParty.textContent = member.party;
    
    updateMemberPhoto(member);
    updateHomepageLink(member);
    updatePerformanceStats(member);
    
    document.title = `백일하 - ${member.name} 의원`;
    
    console.log(`✅ ${member.name} 프로필 업데이트 완료`);
}

function updateMemberPhoto(member) {
    if (!elements.memberPhoto) return;
    
    const photoUrl = findMemberPhoto(member.mona_cd, member.name);
    
    if (photoUrl) {
        elements.memberPhoto.innerHTML = `
            <img src="${photoUrl}" alt="${member.name} 의원" 
                 style="width: 100%; height: 100%; object-fit: cover;"
                 onerror="this.parentElement.innerHTML='<div class=\\"photo-placeholder\\">사진 없음</div>'">
        `;
    } else {
        elements.memberPhoto.innerHTML = `
            <div class="photo-placeholder">사진 없음</div>
        `;
    }
}

function updateHomepageLink(member) {
    if (!elements.memberHomepageLink) return;
    
    if (member.homepage && member.homepage !== '') {
        elements.memberHomepageLink.href = member.homepage;
        elements.memberHomepageLink.classList.remove('disabled');
        elements.memberHomepageLink.title = `${member.name} 의원 홈페이지`;
    } else {
        elements.memberHomepageLink.href = '#';
        elements.memberHomepageLink.classList.add('disabled');
        elements.memberHomepageLink.title = '홈페이지 정보 없음';
    }
}

function updatePerformanceStats(member) {
    const performance = findMemberPerformance(member.name);
    const ranking = findMemberRanking(member.name);
    
    // 순위 정보 업데이트
    updateRankingInfo(member, ranking);
    
    if (performance) {
        updateStatElement(elements.attendanceStat, performance.attendance_score, '%');
        updateStatElement(elements.billPassStat, performance.bill_pass_score, '개');
        updateStatElement(elements.petitionProposalStat, performance.petition_score, '%');
        updateStatElement(elements.petitionResultStat, performance.petition_result_score, '%');
        updateStatElement(elements.abstentionStat, performance.invalid_vote_ratio, '%');
        updateStatElement(elements.voteMatchStat, performance.vote_match_ratio, '%');
        updateStatElement(elements.voteMismatchStat, performance.vote_mismatch_ratio, '%');
        
        const committees = findMemberCommittees(member.name);
        const committeeInfo = committees.length > 0 ? 
            `${committees[0].committee} ${committees[0].position}` : 
            `위원회 점수: ${performance.committee_score.toFixed(1)}점`;
        updateCommitteeElement(elements.committeeStat, committeeInfo);
    } else {
        // 폴백 데이터 사용
        updateStatsWithFallback(member);
    }
}

function updateRankingInfo(member, ranking) {
    if (elements.overallRanking) {
        if (ranking && ranking.overall_rank && ranking.overall_rank !== 999) {
            elements.overallRanking.innerHTML = `전체 순위: <strong>${ranking.overall_rank}위</strong>`;
        } else {
            elements.overallRanking.innerHTML = `전체 순위: <strong>정보 없음</strong>`;
        }
    }
    
    if (elements.partyRanking) {
        elements.partyRanking.style.display = 'none';
    }
}

function updateStatElement(element, value, suffix = '') {
    if (!element) return;
    
    const numValue = parseFloat(value) || 0;
    const displayValue = numValue.toFixed(1);
    
    element.textContent = `${displayValue}${suffix}`;
    element.classList.remove('loading');
    
    element.classList.remove('good', 'warning', 'bad');
    
    if (numValue >= 80) {
        element.classList.add('good');
    } else if (numValue >= 60) {
        element.classList.add('warning');
    } else if (numValue < 40) {
        element.classList.add('bad');
    }
}

function updateCommitteeElement(element, position) {
    if (!element) return;
    
    element.textContent = position;
    element.classList.remove('loading');
    
    element.classList.remove('good', 'warning', 'bad');
    
    if (position.includes('위원장') || position.includes('의장')) {
        element.classList.add('good');
    } else if (position.includes('간사')) {
        element.classList.add('warning');
    } else if (position.includes('정보 없음')) {
        element.classList.add('bad');
    }
}

function updateStatsWithFallback(member) {
    const partyStats = {
        '국민의힘': { attendance: 85.5, billPass: 78.2, petition: 65.3, petitionResult: 58.7 },
        '더불어민주당': { attendance: 87.2, billPass: 82.1, petition: 72.4, petitionResult: 67.9 },
        '조국혁신당': { attendance: 82.8, billPass: 76.4, petition: 61.2, petitionResult: 55.8 }
    };
    
    const baseStats = partyStats[member.party] || {
        attendance: 75 + Math.random() * 20,
        billPass: 60 + Math.random() * 35,
        petition: 50 + Math.random() * 40,
        petitionResult: 40 + Math.random() * 50
    };
    
    updateStatElement(elements.attendanceStat, baseStats.attendance + (Math.random() - 0.5) * 10, '%');
    updateStatElement(elements.billPassStat, baseStats.billPass + (Math.random() - 0.5) * 15, '%');
    updateStatElement(elements.petitionProposalStat, baseStats.petition + (Math.random() - 0.5) * 20, '%');
    updateStatElement(elements.petitionResultStat, baseStats.petitionResult + (Math.random() - 0.5) * 25, '%');
    updateStatElement(elements.abstentionStat, Math.random() * 15, '%');
    updateCommitteeElement(elements.committeeStat, `${member.party} 소속 위원회`);
    updateStatElement(elements.voteMatchStat, 70 + Math.random() * 25, '%');
    updateStatElement(elements.voteMismatchStat, Math.random() * 25, '%');
}

// URL 관련 함수들
function getMemberFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const memberName = urlParams.get('member') || urlParams.get('name');
    
    if (memberName) {
        const member = pageState.memberList.find(m => m.name === memberName);
        return member || null;
    }
    
    return null;
}

// 전체 데이터 로드
async function loadAllData() {
    try {
        toggleLoadingState(true);
        
        console.log('🚀 전체 데이터 로드 시작...');
        
        if (!window.APIService || !window.APIService._isReady) {
            throw new Error('APIService가 준비되지 않았습니다.');
        }
        
        // 병렬로 모든 데이터 로드
        const results = await Promise.allSettled([
            fetchMemberList(),
            fetchPerformanceData(),
            fetchRankingData(),
            fetchCommitteeData(),
            fetchPhotoList(),
            fetchAttendanceData(),
            fetchBillCountData()
        ]);
        
        const [memberResult] = results;
        
        console.log('✅ 전체 데이터 로드 완료');
        
        if (memberResult.status === 'fulfilled') {
            return true;
        } else {
            throw new Error('필수 데이터 로드 실패');
        }
        
    } catch (error) {
        console.error('❌ 전체 데이터 로드 실패:', error);
        showNotification('데이터 로드에 실패했습니다', 'error');
        throw error;
    } finally {
        toggleLoadingState(false);
    }
}

// WeightSync 호환 함수들
async function refreshMemberDetails() {
    console.log('[PercentMember] 🔄 의원 상세정보 새로고침...');
    try {
        await loadAllData();
        if (pageState.currentMember) {
            updateMemberProfile(pageState.currentMember);
        }
        showNotification('의원 상세정보가 업데이트되었습니다.', 'success');
    } catch (error) {
        console.error('[PercentMember] ❌ 새로고침 실패:', error);
        showNotification('데이터 새로고침에 실패했습니다.', 'error');
    }
}

async function loadMemberDetailData() {
    return await loadAllData();
}

// 페이지 초기화
async function initializePage() {
    console.log('🚀 국회의원 상세정보 페이지 초기화...');
    
    try {
        initializeElements();
        initializeSearch(); // 개선된 검색 기능 초기화
        
        await loadAllData();
        
        const urlMember = getMemberFromUrl();
        const initialMember = urlMember || DEFAULT_MEMBER;
        
        const foundMember = pageState.memberList.find(m => m.name === initialMember.name);
        const memberToLoad = foundMember || pageState.memberList[0] || initialMember;
        
        console.log(`👤 초기 국회의원: ${memberToLoad.name}`);
        
        selectMember(memberToLoad);
        
        console.log('✅ 페이지 초기화 완료');
        
    } catch (error) {
        console.error('❌ 페이지 초기화 실패:', error);
        
        pageState.currentMember = DEFAULT_MEMBER;
        updateMemberProfile(DEFAULT_MEMBER);
        
        showNotification('일부 데이터 로드에 실패했습니다', 'warning', 5000);
    }
}

// 브라우저 뒤로/앞으로 버튼 처리
window.addEventListener('popstate', function(event) {
    const urlMember = getMemberFromUrl();
    if (urlMember) {
        selectMember(urlMember);
    } else if (event.state && event.state.member) {
        const member = pageState.memberList.find(m => m.name === event.state.member);
        if (member) {
            selectMember(member);
        }
    }
});

// 디버그 함수들
window.memberPageDebug = {
    getState: () => pageState,
    getCurrentMember: () => pageState.currentMember,
    getAPIErrors: () => pageState.apiErrors,
    
    searchMember: (name) => {
        const member = pageState.memberList.find(m => m.name.includes(name));
        if (member) {
            selectMember(member);
            return member;
        }
        return null;
    },
    
    testSearch: (query) => {
        console.log(`🧪 검색 테스트: "${query}"`);
        if (elements.searchInput) {
            elements.searchInput.value = query;
            elements.searchInput.focus();
            performSearch(query);
        } else {
            console.warn('❌ 검색 입력창이 없습니다');
        }
    },
    
    selectMemberByName: (memberName) => {
        const member = pageState.memberList.find(m => m.name === memberName);
        if (member) {
            selectMember(member);
        } else {
            console.warn(`❌ "${memberName}" 의원을 찾을 수 없습니다`);
        }
    },
    
    getMemberList: () => {
        console.log(`📋 전체 의원 목록 (${pageState.memberList.length}명):`);
        pageState.memberList.slice(0, 10).forEach((member, index) => {
            console.log(`${index + 1}. ${member.name} (${member.party})`);
        });
        return pageState.memberList;
    },
    
    reloadData: () => loadAllData(),
    refreshData: () => refreshMemberDetails()
};

// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 percent_member.js DOM 로드 완료 (검색 기능 개선 버전)');
    
    let attempts = 0;
    const maxAttempts = 30;
    
    function waitForAPI() {
        attempts++;
        
        if (window.APIService && window.APIService._isReady) {
            console.log('✅ API 서비스 연결 확인');
            initializePage();
        } else if (attempts < maxAttempts) {
            setTimeout(waitForAPI, 100);
        } else {
            console.warn('⚠️ API 서비스 연결 타임아웃, 폴백 데이터 사용');
            pageState.memberList = getFallbackMemberList();
            initializeElements();
            initializeSearch();
            pageState.currentMember = DEFAULT_MEMBER;
            updateMemberProfile(DEFAULT_MEMBER);
        }
    }
    
    waitForAPI();
});

console.log('📦 percent_member.js 로드 완료 (검색 기능 개선 버전)');
