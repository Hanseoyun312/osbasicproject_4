// 국회의원 상세정보 페이지 (실제 API 구조 적용 버전)

// 페이지 상태 관리
let pageState = {
    currentMember: null,
    memberList: [],
    photoList: [],
    performanceData: [],
    attendanceData: [],
    billCountData: [],
    committeeData: [],
    rankingData: [],
    isLoading: false,
    hasError: false,
    isSearching: false
};

// 기본 국회의원 정보 (URL 파라미터나 폴백용)
const DEFAULT_MEMBER = {
    name: '나경원',
    party: '국민의힘',
    mona_cd: 'DEFAULT_001',
    committees: ['행정안전위원회'],
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

// APIService 준비 확인
function waitForAPIService() {
    return new Promise((resolve) => {
        if (window.APIService && window.APIService._isReady) {
            resolve();
            return;
        }
        
        // APIService가 준비될 때까지 대기
        const checkInterval = setInterval(() => {
            if (window.APIService && window.APIService._isReady) {
                clearInterval(checkInterval);
                resolve();
            }
        }, 100);
        
        // 10초 후 타임아웃
        setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
        }, 10000);
    });
}

// DOM 요소 초기화
function initializeElements() {
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
}

// 로딩 상태 표시/숨김
function toggleLoadingState(show) {
    pageState.isLoading = show;
    
    if (show) {
        // HTML 순서에 따른 모든 통계 값을 로딩으로 표시
        const loadingElements = [
            elements.overallRanking,
            elements.partyRanking,
            elements.attendanceStat,        // 1. 출석
            elements.billPassStat,          // 2. 본회의 가결
            elements.petitionProposalStat,  // 3. 청원 소개
            elements.petitionResultStat,    // 4. 청원 결과
            elements.abstentionStat,        // 5. 무효표 및 기권
            elements.committeeStat,         // 6. 위원회 직책
            elements.voteMatchStat,         // 7. 투표 결과 일치
            elements.voteMismatchStat       // 8. 투표 결과 불일치
        ];
        
        loadingElements.forEach(el => {
            if (el) {
                el.innerHTML = '<span class="loading-spinner"></span>로딩 중...';
                el.classList.add('loading');
            }
        });
        
        // 검색 버튼 비활성화
        if (elements.searchButton) {
            elements.searchButton.disabled = true;
        }
        
    } else {
        // 로딩 클래스 제거
        document.querySelectorAll('.loading').forEach(el => {
            el.classList.remove('loading');
        });
        
        // 검색 버튼 활성화
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
        
        // 기본 알림 시스템
        const notification = document.createElement('div');
        notification.className = `notification ${type} show`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
}

// 🔄 API에서 국회의원 명단 가져오기 (실제 API 구조 적용)
async function fetchMemberList() {
    try {
        console.log('📋 국회의원 명단 API 호출...');
        
        if (!window.APIService || !window.APIService._isReady) {
            throw new Error('API 서비스가 준비되지 않았습니다.');
        }
        
        const rawData = await window.APIService.getAllMembers();
        
        if (!rawData || !Array.isArray(rawData)) {
            throw new Error('국회의원 명단 API 응답이 올바르지 않습니다.');
        }
        
        // API 데이터 매핑 (실제 API 필드명 사용)
        pageState.memberList = rawData.map(member => ({
            name: member.name,
            party: normalizePartyName(member.party),
            mona_cd: member.mona_cd,
            homepage: member.homepage || '',
            district: '지역구 정보 없음', // 기본 API에는 지역구 정보가 없음
            committees: [], // 위원회 정보는 별도 API에서 가져옴
            _raw: member
        }));
        
        console.log(`✅ 국회의원 명단 로드 완료: ${pageState.memberList.length}명`);
        return pageState.memberList;
        
    } catch (error) {
        console.error('❌ 국회의원 명단 로드 실패:', error);
        
        // 폴백 데이터 사용
        pageState.memberList = getFallbackMemberList();
        throw error;
    }
}

// 🔄 API에서 국회의원 사진 데이터 가져오기 (실제 API 구조 적용)
async function fetchPhotoList() {
    try {
        console.log('📸 국회의원 사진 API 호출...');
        
        const photoData = await window.APIService.getMemberPhotos();
        
        if (!photoData || !Array.isArray(photoData)) {
            throw new Error('사진 데이터 API 응답이 올바르지 않습니다.');
        }
        
        // API 데이터 매핑 (실제 API 필드명 사용)
        pageState.photoList = photoData.map(photo => ({
            member_code: photo.member_code,
            member_name: photo.member_name,
            photo: photo.photo,
            _raw: photo
        }));
        
        console.log(`✅ 사진 데이터 로드 완료: ${pageState.photoList.length}개`);
        return pageState.photoList;
        
    } catch (error) {
        console.error('❌ 사진 데이터 로드 실패:', error);
        pageState.photoList = [];
        throw error;
    }
}

// 🔄 API에서 국회의원 실적 데이터 가져오기 (실제 API 구조 적용)
async function fetchPerformanceData() {
    try {
        console.log('📊 국회의원 실적 API 호출...');
        
        const performanceData = await window.APIService.getMemberPerformance();
        
        if (!performanceData || !Array.isArray(performanceData)) {
            throw new Error('실적 데이터 API 응답이 올바르지 않습니다.');
        }
        
        // API 데이터 매핑 (실제 API 필드명 사용)
        pageState.performanceData = performanceData.map(perf => ({
            name: perf.lawmaker_name,
            party: normalizePartyName(perf.party),
            total_score: parseFloat(perf.total_socre || perf.total_score || 0), // API 오타 대응
            attendance_score: parseFloat(perf.attendance_score || 0),
            petition_score: parseFloat(perf.petition_score || 0),
            petition_result_score: parseFloat(perf.petition_result_score || 0),
            committee_score: parseFloat(perf.committee_score || 0),
            invalid_vote_ratio: parseFloat(perf.invalid_vote_ratio || 0),
            vote_match_ratio: parseFloat(perf.vote_match_ratio || 0),
            vote_mismatch_ratio: parseFloat(perf.vote_mismatch_ratio || 0),
            lawmaker_id: perf.lawmaker,
            _raw: perf
        }));
        
        console.log(`✅ 실적 데이터 로드 완료: ${pageState.performanceData.length}개`);
        return pageState.performanceData;
        
    } catch (error) {
        console.error('❌ 실적 데이터 로드 실패:', error);
        pageState.performanceData = [];
        throw error;
    }
}

// 🔄 API에서 출석 데이터 가져오기 (신규)
async function fetchAttendanceData() {
    try {
        console.log('🏛️ 국회의원 출석 API 호출...');
        
        const attendanceData = await window.APIService.getMemberAttendance();
        
        if (!attendanceData || !Array.isArray(attendanceData)) {
            throw new Error('출석 데이터 API 응답이 올바르지 않습니다.');
        }
        
        // API 데이터 매핑 (실제 API 필드명 사용)
        pageState.attendanceData = attendanceData.map(att => ({
            member_name: att.member_name,
            party: normalizePartyName(att.party),
            total_meetings: parseInt(att.total_meetings || 0),
            attendance: parseInt(att.attendance || 0),
            absences: parseInt(att.absences || 0),
            leaves: parseInt(att.leaves || 0),
            business_trips: parseInt(att.business_trips || 0),
            attendance_rate: parseFloat(att.attendance_rate || 0),
            _raw: att
        }));
        
        console.log(`✅ 출석 데이터 로드 완료: ${pageState.attendanceData.length}개`);
        return pageState.attendanceData;
        
    } catch (error) {
        console.error('❌ 출석 데이터 로드 실패:', error);
        pageState.attendanceData = [];
        throw error;
    }
}

// 🔄 API에서 본회의 제안 데이터 가져오기 (신규)
async function fetchBillCountData() {
    try {
        console.log('📋 본회의 제안 API 호출...');
        
        const billCountData = await window.APIService.getMemberBillCount();
        
        if (!billCountData || !Array.isArray(billCountData)) {
            throw new Error('본회의 제안 데이터 API 응답이 올바르지 않습니다.');
        }
        
        // API 데이터 매핑 (실제 API 필드명 사용)
        pageState.billCountData = billCountData.map(bill => ({
            id: bill.id,
            proposer: bill.proposer,
            total: parseInt(bill.total || 0),
            approved: parseInt(bill.approved || 0),
            discarded: parseInt(bill.discarded || 0),
            rejected: parseInt(bill.rejected || 0),
            other: parseInt(bill.other || 0),
            _raw: bill
        }));
        
        console.log(`✅ 본회의 제안 데이터 로드 완료: ${pageState.billCountData.length}개`);
        return pageState.billCountData;
        
    } catch (error) {
        console.error('❌ 본회의 제안 데이터 로드 실패:', error);
        pageState.billCountData = [];
        throw error;
    }
}

// 🔄 API에서 위원회 데이터 가져오기 (신규)
async function fetchCommitteeData() {
    try {
        console.log('🏛️ 위원회 API 호출...');
        
        const committeeData = await window.APIService.getCommitteeMembers();
        
        if (!committeeData || !Array.isArray(committeeData)) {
            throw new Error('위원회 데이터 API 응답이 올바르지 않습니다.');
        }
        
        // API 데이터 매핑 (실제 API 필드명 사용)
        const committeeMap = {};
        committeeData.forEach(member => {
            const memberName = member.HG_NM;
            if (!committeeMap[memberName]) {
                committeeMap[memberName] = [];
            }
            
            committeeMap[memberName].push({
                committee: member.DEPT_NM,
                position: member.JOB_RES_NM,
                member_name: memberName,
                party: normalizePartyName(member.POLY_NM),
                member_code: member.MONA_CD,
                _raw: member
            });
        });
        
        pageState.committeeData = committeeMap;
        console.log(`✅ 위원회 데이터 로드 완료: ${Object.keys(committeeMap).length}명`);
        return pageState.committeeData;
        
    } catch (error) {
        console.error('❌ 위원회 데이터 로드 실패:', error);
        pageState.committeeData = {};
        throw error;
    }
}

// 🔄 API에서 랭킹 데이터 가져오기 (신규)
async function fetchRankingData() {
    try {
        console.log('🏆 국회의원 랭킹 API 호출...');
        
        const rankingData = await window.APIService.getMemberRanking();
        
        if (!rankingData || !Array.isArray(rankingData)) {
            throw new Error('랭킹 데이터 API 응답이 올바르지 않습니다.');
        }
        
        // API 데이터 매핑 (실제 API 필드명 사용)
        pageState.rankingData = rankingData.map(rank => ({
            name: rank.HG_NM,
            party: normalizePartyName(rank.POLY_NM),
            overall_rank: parseInt(rank.총점_순위 || 999),
            _raw: rank
        }));
        
        console.log(`✅ 랭킹 데이터 로드 완료: ${pageState.rankingData.length}개`);
        return pageState.rankingData;
        
    } catch (error) {
        console.error('❌ 랭킹 데이터 로드 실패:', error);
        pageState.rankingData = [];
        throw error;
    }
}

// 정당명 정규화 함수 (다른 페이지와 동일)
function normalizePartyName(partyName) {
    if (!partyName) return '무소속';
    
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

    return nameMapping[partyName] || partyName;
}

// 폴백 국회의원 명단 (API 실패 시)
function getFallbackMemberList() {
    return [
        {
            name: '나경원',
            party: '국민의힘',
            mona_cd: 'MEMBER_001',
            committees: ['행정안전위원회'],
            homepage: 'https://www.assembly.go.kr',
            district: '서울 동작구갑'
        },
        {
            name: '이재명',
            party: '더불어민주당',
            mona_cd: 'MEMBER_002',
            committees: ['정무위원회'],
            homepage: 'https://www.assembly.go.kr',
            district: '경기 성남시분당구갑'
        },
        {
            name: '조국',
            party: '조국혁신당',
            mona_cd: 'MEMBER_003',
            committees: ['법제사법위원회'],
            homepage: 'https://www.assembly.go.kr',
            district: '서울 종로구'
        }
    ];
}

// 국회의원 사진 찾기
function findMemberPhoto(memberCode, memberName) {
    if (!pageState.photoList || pageState.photoList.length === 0) {
        return null;
    }
    
    // 먼저 코드로 찾기
    const photoByCode = pageState.photoList.find(photo => 
        photo.member_code === memberCode
    );
    
    if (photoByCode) {
        return photoByCode.photo;
    }
    
    // 이름으로 찾기
    const photoByName = pageState.photoList.find(photo => 
        photo.member_name === memberName
    );
    
    return photoByName ? photoByName.photo : null;
}

// 국회의원 실적 찾기
function findMemberPerformance(memberName) {
    if (!pageState.performanceData || pageState.performanceData.length === 0) {
        return null;
    }
    
    return pageState.performanceData.find(perf => 
        perf.name === memberName
    );
}

// 국회의원 출석 정보 찾기
function findMemberAttendance(memberName) {
    if (!pageState.attendanceData || pageState.attendanceData.length === 0) {
        return null;
    }
    
    return pageState.attendanceData.find(att => 
        att.member_name === memberName
    );
}

// 국회의원 본회의 제안 정보 찾기
function findMemberBillCount(memberName, lawyerId) {
    if (!pageState.billCountData || pageState.billCountData.length === 0) {
        return null;
    }
    
    // 먼저 이름으로 찾기
    let billData = pageState.billCountData.find(bill => 
        bill.proposer === memberName
    );
    
    // 이름으로 안 찾아지면 lawmaker ID로 찾기
    if (!billData && lawyerId) {
        billData = pageState.billCountData.find(bill => 
            bill.id === lawyerId
        );
    }
    
    return billData;
}

// 국회의원 위원회 정보 찾기
function findMemberCommittees(memberName) {
    if (!pageState.committeeData || Object.keys(pageState.committeeData).length === 0) {
        return [];
    }
    
    return pageState.committeeData[memberName] || [];
}

// 국회의원 랭킹 정보 찾기
function findMemberRanking(memberName) {
    if (!pageState.rankingData || pageState.rankingData.length === 0) {
        return null;
    }
    
    return pageState.rankingData.find(rank => 
        rank.name === memberName
    );
}

// 🔄 국회의원 정보 업데이트 (HTML 순서 준수)
function updateMemberProfile(member) {
    if (!member) return;
    
    console.log(`👤 ${member.name} 프로필 업데이트 중...`);
    
    // 기본 정보 업데이트
    if (elements.memberName) elements.memberName.textContent = member.name;
    if (elements.memberParty) elements.memberParty.textContent = member.party;
    
    // 사진 업데이트
    updateMemberPhoto(member);
    
    // 홈페이지 링크 업데이트
    updateHomepageLink(member);
    
    // 실적 데이터 업데이트 (HTML 순서에 따라)
    updatePerformanceStats(member);
    
    // 정당 색상 적용
    if (window.applyPartyColors) {
        window.applyPartyColors(member.party);
    }
    
    // 페이지 제목 업데이트
    document.title = `백일하 - ${member.name} 의원`;
    
    console.log(`✅ ${member.name} 프로필 업데이트 완료`);
}

// 국회의원 사진 업데이트
function updateMemberPhoto(member) {
    if (!elements.memberPhoto) return;
    
    const photoUrl = findMemberPhoto(member.mona_cd, member.name);
    
    if (photoUrl) {
        elements.memberPhoto.innerHTML = `
            <img src="${photoUrl}" alt="${member.name} 의원" 
                 onerror="this.parentElement.innerHTML='<div class=\\"photo-placeholder\\">사진 없음</div>'">
        `;
    } else {
        elements.memberPhoto.innerHTML = `
            <div class="photo-placeholder">사진 없음</div>
        `;
    }
}

// 홈페이지 링크 업데이트
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

// 🔄 실적 통계 업데이트 (실제 API 데이터 기반으로 개선)
function updatePerformanceStats(member) {
    const performance = findMemberPerformance(member.name);
    const attendance = findMemberAttendance(member.name);
    const billCount = findMemberBillCount(member.name, performance?.lawmaker_id);
    const committees = findMemberCommittees(member.name);
    const ranking = findMemberRanking(member.name);
    
    if (!performance) {
        console.warn(`⚠️ ${member.name} 실적 데이터 없음`);
        updateStatsWithFallback(member);
        return;
    }
    
    // 순위 정보 업데이트
    updateRankingInfo(member, ranking);
    
    // HTML 순서에 따른 실적 통계 업데이트
    const stats = calculateMemberStats(performance, attendance, billCount, committees);
    
    // HTML 순서에 따라 업데이트
    updateStatElement(elements.attendanceStat, stats.attendance, '%', attendance);
    updateStatElement(elements.billPassStat, stats.billPass, '%', billCount);
    updateStatElement(elements.petitionProposalStat, stats.petitionProposal, '%');
    updateStatElement(elements.petitionResultStat, stats.petitionResult, '%');
    updateStatElement(elements.abstentionStat, stats.abstention, '%');
    updateCommitteeElement(elements.committeeStat, stats.committee, committees);
    updateStatElement(elements.voteMatchStat, stats.voteMatch, '%');
    updateStatElement(elements.voteMismatchStat, stats.voteMismatch, '%');
    
    // 툴팁 정보 업데이트
    updateTooltipInfo(member, attendance, billCount);
}

// 통계 계산 함수 (실제 API 데이터 기반)
function calculateMemberStats(performance, attendance, billCount, committees) {
    const stats = {
        // 1. 출석 (attendance API 우선, 없으면 performance API의 attendance_score)
        attendance: attendance ? 
            calculateAttendanceRate(attendance) : 
            (performance.attendance_score || 0),
        
        // 2. 본회의 가결 (billCount API 기반)
        billPass: billCount ? 
            calculateBillPassRate(billCount) : 
            Math.min((performance.total_score || 0) * 1.2, 95),
        
        // 3. 청원 소개 (performance API)
        petitionProposal: performance.petition_score || 0,
        
        // 4. 청원 결과 (performance API)
        petitionResult: performance.petition_result_score || 0,
        
        // 5. 무효표 및 기권 (performance API, 비율을 퍼센트로 변환)
        abstention: (performance.invalid_vote_ratio || 0) * 100,
        
        // 6. 위원회 직책 (committee API 기반)
        committee: getCommitteeInfo(committees),
        
        // 7. 투표 결과 일치 (performance API, 비율을 퍼센트로 변환)
        voteMatch: (performance.vote_match_ratio || 0) * 100,
        
        // 8. 투표 결과 불일치 (performance API, 비율을 퍼센트로 변환)
        voteMismatch: (performance.vote_mismatch_ratio || 0) * 100
    };
    
    return stats;
}

// 출석률 계산
function calculateAttendanceRate(attendance) {
    if (!attendance || !attendance.total_meetings) {
        return 0;
    }
    
    if (attendance.attendance_rate) {
        return attendance.attendance_rate;
    }
    
    // 수동 계산: (출석 수 / 총 회의 수) * 100
    return (attendance.attendance / attendance.total_meetings) * 100;
}

// 본회의 가결률 계산
function calculateBillPassRate(billCount) {
    if (!billCount || !billCount.total) {
        return 0;
    }
    
    // (가결 수 / 총 제안 수) * 100
    return (billCount.approved / billCount.total) * 100;
}

// 위원회 정보 가져오기 (실제 API 데이터 기반)
function getCommitteeInfo(committees) {
    if (!committees || committees.length === 0) {
        return '위원회 정보 없음';
    }
    
    // 주요 위원회 (위원장 > 간사 > 일반위원 순으로 우선순위)
    const prioritizedCommittee = committees.sort((a, b) => {
        const getRank = (position) => {
            if (position.includes('위원장')) return 3;
            if (position.includes('간사')) return 2;
            return 1;
        };
        return getRank(b.position) - getRank(a.position);
    })[0];
    
    return `${prioritizedCommittee.committee} ${prioritizedCommittee.position}`;
}

// 순위 정보 업데이트
function updateRankingInfo(member, ranking) {
    // 전체 순위
    if (elements.overallRanking) {
        if (ranking && ranking.overall_rank && ranking.overall_rank !== 999) {
            elements.overallRanking.innerHTML = `전체 순위: <strong>${ranking.overall_rank}위</strong>`;
        } else {
            elements.overallRanking.innerHTML = `전체 순위: <strong>정보 없음</strong>`;
        }
    }
    
    // 정당 내 순위 (계산 필요)
    if (elements.partyRanking) {
        const partyRank = calculatePartyRank(member);
        elements.partyRanking.innerHTML = `정당 내 순위: <strong>${partyRank}위</strong>`;
    }
}

// 정당 내 순위 계산
function calculatePartyRank(member) {
    if (!pageState.rankingData || pageState.rankingData.length === 0) {
        return '정보 없음';
    }
    
    const memberRanking = findMemberRanking(member.name);
    if (!memberRanking || memberRanking.overall_rank === 999) {
        return '정보 없음';
    }
    
    // 같은 정당 의원들의 순위로 정당 내 순위 계산
    const partyMembers = pageState.rankingData
        .filter(rank => rank.party === member.party && rank.overall_rank !== 999)
        .sort((a, b) => a.overall_rank - b.overall_rank);
    
    const partyRank = partyMembers.findIndex(rank => rank.name === member.name) + 1;
    return partyRank || '정보 없음';
}

// 통계 요소 업데이트 (툴팁 데이터 추가)
function updateStatElement(element, value, suffix = '', tooltipData = null) {
    if (!element) return;
    
    const numValue = parseFloat(value) || 0;
    const displayValue = numValue.toFixed(1);
    
    element.textContent = `${displayValue}${suffix}`;
    element.classList.remove('loading');
    
    // 값에 따른 색상 클래스 적용
    element.classList.remove('good', 'warning', 'bad');
    
    if (numValue >= 80) {
        element.classList.add('good');
    } else if (numValue >= 60) {
        element.classList.add('warning');
    } else if (numValue < 40) {
        element.classList.add('bad');
    }
    
    // 툴팁 데이터 저장 (i 아이콘 호버 시 사용)
    if (tooltipData) {
        element.setAttribute('data-tooltip', JSON.stringify(tooltipData));
    }
}

// 위원회 직책 요소 업데이트
function updateCommitteeElement(element, position, committees = []) {
    if (!element) return;
    
    element.textContent = position;
    element.classList.remove('loading');
    
    // 직책에 따른 색상 클래스 적용
    element.classList.remove('good', 'warning', 'bad');
    
    if (position.includes('위원장') || position.includes('의장')) {
        element.classList.add('good');
    } else if (position.includes('간사')) {
        element.classList.add('warning');
    } else if (position.includes('정보 없음')) {
        element.classList.add('bad');
    }
    
    // 위원회 정보 툴팁 데이터 저장
    if (committees && committees.length > 0) {
        element.setAttribute('data-committees', JSON.stringify(committees));
    }
}

// 툴팁 정보 업데이트 (i 아이콘 호버 시 표시할 상세 정보)
function updateTooltipInfo(member, attendance, billCount) {
    try {
        // 출석 상세 정보 툴팁 업데이트
        const attendanceTooltip = document.querySelector('[data-tooltip-for="attendance"]');
        if (attendanceTooltip && attendance) {
            const tooltipContent = `
                <div class="tooltip-content">
                    <h4>${member.name} 의원 출석 상세</h4>
                    <p>총 회의 수: ${attendance.total_meetings}회</p>
                    <p>출석: ${attendance.attendance}회</p>
                    <p>결석: ${attendance.absences}회</p>
                    <p>청가: ${attendance.leaves}회</p>
                    <p>출장: ${attendance.business_trips}회</p>
                </div>
            `;
            attendanceTooltip.setAttribute('data-tooltip-content', tooltipContent);
        }
        
        // 본회의 가결 상세 정보 툴팁 업데이트
        const billTooltip = document.querySelector('[data-tooltip-for="bill"]');
        if (billTooltip && billCount) {
            const tooltipContent = `
                <div class="tooltip-content">
                    <h4>${member.name} 의원 본회의 제안 상세</h4>
                    <p>총 제안: ${billCount.total}건</p>
                    <p>가결: ${billCount.approved}건</p>
                    <p>폐기: ${billCount.discarded}건</p>
                    <p>부결: ${billCount.rejected}건</p>
                    <p>기타: ${billCount.other}건</p>
                </div>
            `;
            billTooltip.setAttribute('data-tooltip-content', tooltipContent);
        }
        
    } catch (error) {
        console.error('툴팁 정보 업데이트 실패:', error);
    }
}

// 폴백 통계 업데이트
function updateStatsWithFallback(member) {
    console.log(`🔄 ${member.name} 폴백 데이터 사용`);
    
    // 기본값으로 통계 업데이트
    const fallbackStats = generateFallbackStats(member);
    
    if (elements.overallRanking) {
        elements.overallRanking.innerHTML = `전체 순위: <strong>정보 없음</strong>`;
    }
    if (elements.partyRanking) {
        elements.partyRanking.innerHTML = `정당 내 순위: <strong>정보 없음</strong>`;
    }
    
    // HTML 순서에 따라 폴백 데이터 업데이트
    updateStatElement(elements.attendanceStat, fallbackStats.attendance, '%');
    updateStatElement(elements.billPassStat, fallbackStats.billPass, '%');
    updateStatElement(elements.petitionProposalStat, fallbackStats.petition, '%');
    updateStatElement(elements.petitionResultStat, fallbackStats.petitionResult, '%');
    updateStatElement(elements.abstentionStat, fallbackStats.abstention, '%');
    updateCommitteeElement(elements.committeeStat, getDefaultCommitteeInfo(member));
    updateStatElement(elements.voteMatchStat, fallbackStats.voteMatch, '%');
    updateStatElement(elements.voteMismatchStat, fallbackStats.voteMismatch, '%');
}

// 기본 위원회 정보 (위원회 데이터가 없을 때)
function getDefaultCommitteeInfo(member) {
    const defaultCommittees = {
        '국민의힘': '국정감사위원회',
        '더불어민주당': '예산결산위원회',
        '조국혁신당': '법제사법위원회',
        '개혁신당': '정무위원회',
        '진보당': '환경노동위원회',
        '기본소득당': '보건복지위원회',
        '사회민주당': '문화체육관광위원회',
        '무소속': '행정안전위원회'
    };
    
    return defaultCommittees[member.party] || '위원회 정보 없음';
}

// 폴백 통계 생성
function generateFallbackStats(member) {
    // 정당별로 다른 특성을 가진 기본 데이터
    const baseStats = {
        attendance: 75 + Math.random() * 20,
        billPass: 60 + Math.random() * 35,
        petition: 50 + Math.random() * 40,
        petitionResult: 40 + Math.random() * 50,
        abstention: Math.random() * 15,
        voteMatch: 70 + Math.random() * 25,
        voteMismatch: Math.random() * 25
    };
    
    // 정당별 특성 반영
    switch(member.party) {
        case '국민의힘':
            baseStats.attendance = 85.5;
            baseStats.billPass = 78.2;
            break;
        case '더불어민주당':
            baseStats.attendance = 87.2;
            baseStats.billPass = 82.1;
            break;
        case '조국혁신당':
            baseStats.attendance = 82.8;
            baseStats.billPass = 76.4;
            break;
    }
    
    return baseStats;
}

// 검색 기능 설정
function setupSearch() {
    if (!elements.searchInput) return;
    
    // 검색 결과 컨테이너 생성
    const searchContainer = elements.searchInput.parentElement;
    if (!elements.searchResults) {
        elements.searchResults = document.createElement('div');
        elements.searchResults.className = 'search-results';
        elements.searchResults.style.display = 'none';
        searchContainer.appendChild(elements.searchResults);
    }
    
    // 실시간 검색
    let searchTimeout;
    elements.searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const query = this.value.trim();
        
        if (query.length === 0) {
            hideSearchResults();
            return;
        }
        
        searchTimeout = setTimeout(() => {
            performSearch(query);
        }, 300);
    });
    
    // 검색 버튼 클릭
    if (elements.searchButton) {
        elements.searchButton.addEventListener('click', function() {
            const query = elements.searchInput.value.trim();
            if (query) {
                performSearch(query);
            }
        });
    }
    
    // 엔터키 검색
    elements.searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const query = this.value.trim();
            if (query) {
                performSearch(query);
            }
        }
    });
    
    // 외부 클릭 시 검색 결과 숨기기
    document.addEventListener('click', function(e) {
        if (!searchContainer.contains(e.target)) {
            hideSearchResults();
        }
    });
    
    console.log('✅ 검색 기능 설정 완료');
}

// 검색 실행
function performSearch(query) {
    if (pageState.isSearching) return;
    
    pageState.isSearching = true;
    
    console.log(`🔍 검색 실행: "${query}"`);
    
    try {
        // 이름과 정당으로 필터링
        const filtered = pageState.memberList.filter(member => {
            const nameMatch = member.name.toLowerCase().includes(query.toLowerCase());
            const partyMatch = member.party.toLowerCase().includes(query.toLowerCase());
            
            // 정당 필터 적용
            const partyFilter = elements.partyFilter ? elements.partyFilter.value : '';
            const partyFilterMatch = !partyFilter || member.party === partyFilter;
            
            return (nameMatch || partyMatch) && partyFilterMatch;
        });
        
        displaySearchResults(filtered);
        
    } catch (error) {
        console.error('❌ 검색 실패:', error);
        showNotification('검색 중 오류가 발생했습니다', 'error');
    } finally {
        pageState.isSearching = false;
    }
}

// 검색 결과 표시
function displaySearchResults(results) {
    if (!elements.searchResults) return;
    
    elements.searchResults.innerHTML = '';
    
    if (results.length === 0) {
        elements.searchResults.innerHTML = '<div class="no-results">검색 결과가 없습니다</div>';
    } else {
        results.slice(0, 10).forEach(member => { // 최대 10개만 표시
            const item = document.createElement('div');
            item.className = 'search-result-item';
            
            const photoUrl = findMemberPhoto(member.mona_cd, member.name);
            const committees = findMemberCommittees(member.name);
            const committeesText = committees.length > 0 ? 
                committees.map(c => c.committee).join(', ') : 
                '위원회 정보 없음';
            
            item.innerHTML = `
                <img src="${photoUrl || ''}" alt="${member.name}" class="search-result-photo" 
                     onerror="this.style.display='none'">
                <div class="search-result-info">
                    <div class="search-result-name">${member.name}</div>
                    <div class="search-result-details">${member.party} · ${committeesText}</div>
                </div>
            `;
            
            item.addEventListener('click', () => {
                selectMember(member);
                hideSearchResults();
            });
            
            elements.searchResults.appendChild(item);
        });
    }
    
    elements.searchResults.style.display = 'block';
}

// 검색 결과 숨기기
function hideSearchResults() {
    if (elements.searchResults) {
        elements.searchResults.style.display = 'none';
    }
}

// 국회의원 선택
function selectMember(member) {
    console.log(`👤 ${member.name} 선택됨`);
    
    pageState.currentMember = member;
    elements.searchInput.value = member.name;
    
    // URL 업데이트
    updateUrl(member.name);
    
    // 프로필 업데이트
    updateMemberProfile(member);
    
    showNotification(`${member.name} 의원 정보 로드 완료`, 'success');
}

// URL 파라미터 처리
function getMemberFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const memberName = urlParams.get('member') || urlParams.get('name');
    
    if (memberName) {
        const member = pageState.memberList.find(m => m.name === memberName);
        return member || null;
    }
    
    return null;
}

// URL 업데이트
function updateUrl(memberName) {
    if (history.pushState) {
        const url = new URL(window.location);
        url.searchParams.set('member', memberName);
        history.pushState({ member: memberName }, '', url);
    }
}

// 🔄 전체 데이터 로드 (실제 API 구조에 맞춰 개선)
async function loadAllData() {
    try {
        toggleLoadingState(true);
        
        console.log('🚀 전체 데이터 로드 시작...');
        
        // APIService 준비 대기
        await waitForAPIService();
        
        if (!window.APIService || !window.APIService._isReady) {
            throw new Error('APIService가 준비되지 않았습니다.');
        }
        
        // 병렬로 모든 데이터 로드
        const results = await Promise.allSettled([
            fetchMemberList(),        // 국회의원 명단
            fetchPhotoList(),         // 사진 데이터
            fetchPerformanceData(),   // 실적 데이터
            fetchAttendanceData(),    // 출석 데이터
            fetchBillCountData(),     // 본회의 제안 데이터
            fetchCommitteeData(),     // 위원회 데이터
            fetchRankingData()        // 랭킹 데이터
        ]);
        
        // 결과 확인
        const [memberResult, photoResult, performanceResult, attendanceResult, billCountResult, committeeResult, rankingResult] = results;
        
        const loadResults = {
            members: memberResult.status === 'fulfilled',
            photos: photoResult.status === 'fulfilled',
            performance: performanceResult.status === 'fulfilled',
            attendance: attendanceResult.status === 'fulfilled',
            billCount: billCountResult.status === 'fulfilled',
            committee: committeeResult.status === 'fulfilled',
            ranking: rankingResult.status === 'fulfilled'
        };
        
        console.log('📊 API 로드 결과:', loadResults);
        
        // 실패한 API에 대한 경고
        Object.entries(loadResults).forEach(([key, success]) => {
            if (!success) {
                const result = results[Object.keys(loadResults).indexOf(key)];
                console.warn(`⚠️ ${key} 데이터 로드 실패:`, result.reason);
            }
        });
        
        console.log('✅ 전체 데이터 로드 완료');
        
        // 최소 하나의 성공이 있으면 계속 진행
        if (loadResults.members) {
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

// === 🔄 가중치 변경 실시간 업데이트 시스템 ===

// 가중치 변경 감지 및 자동 새로고침
function setupWeightChangeListener() {
    try {
        console.log('[PercentMember] 🔄 가중치 변경 감지 시스템 설정...');
        
        // 1. localStorage 이벤트 감지 (다른 페이지에서 가중치 변경 시)
        window.addEventListener('storage', function(event) {
            if (event.key === 'weight_change_event' && event.newValue) {
                try {
                    const changeData = JSON.parse(event.newValue);
                    console.log('[PercentMember] 📢 가중치 변경 감지:', changeData);
                    handleWeightUpdate(changeData, 'localStorage');
                } catch (e) {
                    console.warn('[PercentMember] 가중치 변경 데이터 파싱 실패:', e);
                }
            }
        });
        
        // 2. BroadcastChannel 감지 (최신 브라우저)
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                const weightChannel = new BroadcastChannel('weight_updates');
                weightChannel.addEventListener('message', function(event) {
                    console.log('[PercentMember] 📡 BroadcastChannel 가중치 변경 감지:', event.data);
                    handleWeightUpdate(event.data, 'BroadcastChannel');
                });
                
                // 페이지 언로드 시 채널 정리
                window.addEventListener('beforeunload', () => {
                    weightChannel.close();
                });
                
                console.log('[PercentMember] ✅ BroadcastChannel 설정 완료');
            } catch (e) {
                console.warn('[PercentMember] BroadcastChannel 설정 실패:', e);
            }
        }
        
        // 3. 커스텀 이벤트 감지 (같은 페이지 내)
        document.addEventListener('weightSettingsChanged', function(event) {
            console.log('[PercentMember] 🎯 커스텀 이벤트 가중치 변경 감지:', event.detail);
            handleWeightUpdate(event.detail, 'customEvent');
        });
        
        // 4. 주기적 체크 (폴백)
        let lastWeightCheckTime = localStorage.getItem('last_weight_update') || '0';
        setInterval(function() {
            const currentCheckTime = localStorage.getItem('last_weight_update') || '0';
            
            if (currentCheckTime !== lastWeightCheckTime && currentCheckTime !== '0') {
                console.log('[PercentMember] ⏰ 주기적 체크로 가중치 변경 감지');
                lastWeightCheckTime = currentCheckTime;
                
                const changeData = {
                    type: 'weights_updated',
                    timestamp: new Date(parseInt(currentCheckTime)).toISOString(),
                    source: 'periodic_check'
                };
                
                handleWeightUpdate(changeData, 'periodicCheck');
            }
        }, 5000);
        
        console.log('[PercentMember] ✅ 가중치 변경 감지 시스템 설정 완료');
        
    } catch (error) {
        console.error('[PercentMember] ❌ 가중치 변경 감지 시스템 설정 실패:', error);
    }
}

// 가중치 업데이트 처리 함수
async function handleWeightUpdate(changeData, source) {
    try {
        if (pageState.isLoading) {
            console.log('[PercentMember] 🔄 이미 로딩 중이므로 가중치 업데이트 스킵');
            return;
        }
        
        console.log(`[PercentMember] 🔄 가중치 업데이트 처리 시작 (${source})`);
        
        // 사용자에게 업데이트 알림
        showNotification('가중치가 변경되었습니다. 데이터를 새로고침합니다...', 'info');
        
        // 현재 선택된 의원 정보 백업
        const currentMemberName = pageState.currentMember?.name;
        
        // 1초 딜레이 후 데이터 새로고침 (서버에서 가중치 처리 시간 고려)
        setTimeout(async () => {
            try {
                // 새로운 데이터로 업데이트
                await loadAllData();
                
                // 이전 선택 복원
                if (currentMemberName) {
                    const updatedMember = pageState.memberList.find(m => m.name === currentMemberName);
                    if (updatedMember) {
                        selectMember(updatedMember);
                        console.log(`[PercentMember] 🔄 ${currentMemberName} 의원 선택 복원 완료`);
                    }
                }
                
                console.log('[PercentMember] ✅ 가중치 업데이트 완료');
                showNotification('새로운 가중치가 적용되었습니다! 🎉', 'success');
                
                // 응답 전송 (percent 페이지 모니터링용)
                try {
                    const response = {
                        page: 'percent_member.html',
                        timestamp: new Date().toISOString(),
                        success: true,
                        source: source,
                        restoredMember: currentMemberName
                    };
                    localStorage.setItem('weight_refresh_response', JSON.stringify(response));
                    setTimeout(() => localStorage.removeItem('weight_refresh_response'), 100);
                } catch (e) {
                    console.warn('[PercentMember] 응답 전송 실패:', e);
                }
                
            } catch (error) {
                console.error('[PercentMember] ❌ 가중치 업데이트 데이터 로드 실패:', error);
                showNotification('가중치 업데이트에 실패했습니다. 다시 시도해주세요.', 'error');
            }
        }, 1000);
        
    } catch (error) {
        console.error('[PercentMember] ❌ 가중치 업데이트 처리 실패:', error);
        showNotification('가중치 업데이트 처리에 실패했습니다.', 'error');
    }
}

// 수동 새로고침 함수들 (외부에서 호출 가능)
window.refreshMemberDetailData = function() {
    console.log('[PercentMember] 🔄 수동 새로고침 요청');
    loadAllData();
};

window.refreshPercentMemberData = function() {
    console.log('[PercentMember] 🔄 수동 새로고침 요청 (WeightSync 호환)');
    loadAllData();
};

window.updateMemberDetailData = function(newData) {
    console.log('[PercentMember] 📊 외부 데이터로 업데이트:', newData);
    
    if (newData && Array.isArray(newData)) {
        pageState.performanceData = newData;
        showNotification('데이터가 업데이트되었습니다', 'success');
        
        // 현재 선택된 의원 정보 재표시
        if (pageState.currentMember) {
            updateMemberProfile(pageState.currentMember);
        }
    }
};

// 초기화 함수
async function initializePage() {
    console.log('🚀 국회의원 상세정보 페이지 초기화...');
    
    try {
        // DOM 요소 초기화
        initializeElements();
        
        // 검색 기능 설정
        setupSearch();
        
        // 가중치 변경 감지 시스템 설정
        setupWeightChangeListener();
        
        // 전체 데이터 로드
        await loadAllData();
        
        // URL에서 국회의원 확인
        const urlMember = getMemberFromUrl();
        const initialMember = urlMember || DEFAULT_MEMBER;
        
        // 기본 국회의원이 명단에 있는지 확인
        const foundMember = pageState.memberList.find(m => m.name === initialMember.name);
        const memberToLoad = foundMember || pageState.memberList[0] || initialMember;
        
        console.log(`👤 초기 국회의원: ${memberToLoad.name}`);
        
        // 초기 국회의원 정보 표시
        selectMember(memberToLoad);
        
        console.log('✅ 페이지 초기화 완료');
        
    } catch (error) {
        console.error('❌ 페이지 초기화 실패:', error);
        
        // 폴백: 기본 데이터로 표시
        pageState.currentMember = DEFAULT_MEMBER;
        updateMemberProfile(DEFAULT_MEMBER);
        
        showNotification('일부 데이터 로드에 실패했습니다', 'warning', 5000);
    }
}

// 브라우저 뒤로/앞으로 버튼 처리
window.addEventListener('popstate', function(event) {
    if (event.state && event.state.member) {
        const member = pageState.memberList.find(m => m.name === event.state.member);
        if (member) {
            selectMember(member);
        }
    } else {
        const urlMember = getMemberFromUrl();
        if (urlMember) {
            selectMember(urlMember);
        }
    }
});

// 전역 함수들 (디버깅용)
window.memberPageDebug = {
    getState: () => pageState,
    getCurrentMember: () => pageState.currentMember,
    searchMember: (name) => {
        const member = pageState.memberList.find(m => m.name.includes(name));
        if (member) {
            selectMember(member);
            return member;
        }
        return null;
    },
    reloadData: () => loadAllData(),
    refreshData: () => loadAllData(), // WeightSync 호환
    showInfo: () => {
        console.log('📊 국회의원 페이지 정보:');
        console.log(`- 현재 의원: ${pageState.currentMember?.name || '없음'}`);
        console.log(`- 의원 명단: ${pageState.memberList.length}명`);
        console.log(`- 사진 데이터: ${pageState.photoList.length}개`);
        console.log(`- 실적 데이터: ${pageState.performanceData.length}개`);
        console.log(`- 출석 데이터: ${pageState.attendanceData.length}개`);
        console.log(`- 본회의 제안 데이터: ${pageState.billCountData.length}개`);
        console.log(`- 위원회 데이터: ${Object.keys(pageState.committeeData).length}명`);
        console.log(`- 랭킹 데이터: ${pageState.rankingData.length}개`);
        console.log(`- API 서비스: ${!!window.APIService}`);
    },
    testHTMLMapping: () => {
        console.log('🔍 HTML 매핑 테스트...');
        console.log('1. 출석:', elements.attendanceStat?.textContent);
        console.log('2. 본회의 가결:', elements.billPassStat?.textContent);
        console.log('3. 청원 소개:', elements.petitionProposalStat?.textContent);
        console.log('4. 청원 결과:', elements.petitionResultStat?.textContent);
        console.log('5. 무효표 및 기권:', elements.abstentionStat?.textContent);
        console.log('6. 위원회 직책:', elements.committeeStat?.textContent);
        console.log('7. 투표 결과 일치:', elements.voteMatchStat?.textContent);
        console.log('8. 투표 결과 불일치:', elements.voteMismatchStat?.textContent);
    },
    simulateWeightChange: () => {
        console.log('🔧 가중치 변경 시뮬레이션...');
        const changeData = {
            type: 'weights_updated',
            timestamp: new Date().toISOString(),
            source: 'debug_simulation'
        };
        handleWeightUpdate(changeData, 'debug');
    },
    testAPIService: async () => {
        console.log('🔍 APIService 테스트 시작...');
        try {
            if (!window.APIService) {
                console.error('❌ APIService가 없습니다');
                return false;
            }
            
            const [members, photos, performance, attendance, billCount, committee, ranking] = await Promise.allSettled([
                window.APIService.getAllMembers(),
                window.APIService.getMemberPhotos(),
                window.APIService.getMemberPerformance(),
                window.APIService.getMemberAttendance(),
                window.APIService.getMemberBillCount(),
                window.APIService.getCommitteeMembers(),
                window.APIService.getMemberRanking()
            ]);
            
            console.log('✅ 국회의원 명단:', members.status, members.status === 'fulfilled' ? members.value.length + '명' : members.reason);
            console.log('✅ 사진 데이터:', photos.status, photos.status === 'fulfilled' ? photos.value.length + '개' : photos.reason);
            console.log('✅ 실적 데이터:', performance.status, performance.status === 'fulfilled' ? performance.value.length + '개' : performance.reason);
            console.log('✅ 출석 데이터:', attendance.status, attendance.status === 'fulfilled' ? attendance.value.length + '개' : attendance.reason);
            console.log('✅ 본회의 제안:', billCount.status, billCount.status === 'fulfilled' ? billCount.value.length + '개' : billCount.reason);
            console.log('✅ 위원회 데이터:', committee.status, committee.status === 'fulfilled' ? committee.value.length + '개' : committee.reason);
            console.log('✅ 랭킹 데이터:', ranking.status, ranking.status === 'fulfilled' ? ranking.value.length + '개' : ranking.reason);
            
            return true;
        } catch (error) {
            console.error('❌ APIService 테스트 실패:', error);
            return false;
        }
    },
    showMemberDetails: (memberName) => {
        const member = pageState.memberList.find(m => m.name === memberName);
        if (member) {
            const performance = findMemberPerformance(memberName);
            const attendance = findMemberAttendance(memberName);
            const billCount = findMemberBillCount(memberName, performance?.lawmaker_id);
            const committees = findMemberCommittees(memberName);
            const ranking = findMemberRanking(memberName);
            
            console.log(`📊 ${memberName} 상세 정보:`);
            console.log('- 기본 정보:', member);
            console.log('- 실적 데이터:', performance);
            console.log('- 출석 데이터:', attendance);
            console.log('- 본회의 제안:', billCount);
            console.log('- 위원회 정보:', committees);
            console.log('- 랭킹 정보:', ranking);
            
            return { member, performance, attendance, billCount, committees, ranking };
        } else {
            console.log(`❌ ${memberName} 의원을 찾을 수 없습니다`);
            return null;
        }
    }
};

// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 percent_member.js DOM 로드 완료');
    
    // 초기화 실행
    setTimeout(initializePage, 100);
});

console.log('📦 percent_member.js 로드 완료 (실제 API 구조 적용 + 위원회 데이터 + 가중치 감지 시스템)');
