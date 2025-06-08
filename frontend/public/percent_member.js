// 정당별 CSS 변수 매핑
const partyCSSVariables = {
    "더불어민주당": "--party-dp-main",
    "국민의힘": "--party-ppp-main",
    "조국혁신당": "--party-rk-main",
    "개혁신당": "--party-reform-main",
    "진보당": "--party-jp-main",
    "기본소득당": "--party-bip-main",
    "사회민주당": "--party-sdp-main",
    "무소속": "--party-ind-main"
};

// CSS 변수에서 색상 값 가져오기
function getPartyColor(partyName) {
    const cssVariable = partyCSSVariables[partyName];
    if (cssVariable) {
        return getComputedStyle(document.documentElement).getPropertyValue(cssVariable).trim();
    }
    return '#E61E2B'; // 기본 색상 (국민의힘)
}

// 샘플 국회의원 데이터 (실제로는 서버에서 받아올 데이터)
const memberData = {
    "나경원": {
        name: "나경원",
        party: "국민의힘",
        district: "서울 동작구을",
        photo: "/api/placeholder/250/330",
        homepage: null, // 예시 URL
        stats: {
            attendance: 94.2,
            billPass: 38.5,
            petitionProposal: 85.3,
            petitionResult: 72.1,
            abstention: 3.2,
            committee: 2,
            voteMatch: 91.7,
            voteMismatch: 8.3
        },
        rankings: {
            overall: 45,
            party: 12
        }
    },
    "이재명": {
        name: "이재명",
        party: "더불어민주당",
        district: "인천 계양구을",
        photo: "/api/placeholder/250/330",
        homepage: null, // 홈페이지 없는 경우
        stats: {
            attendance: 96.5,
            billPass: 42.3,
            petitionProposal: 88.7,
            petitionResult: 78.9,
            abstention: 2.1,
            committee: 3,
            voteMatch: 93.4,
            voteMismatch: 6.6
        },
        rankings: {
            overall: 23,
            party: 8
        }
    }
};

// DOM 로드 후 실행
document.addEventListener('DOMContentLoaded', function() {
    let currentMemberData = null; // 현재 표시중인 의원 데이터 저장

    // 집 아이콘 클릭 이벤트 설정
    const homeIconLink = document.querySelector('.home-icon a');
    
    if (homeIconLink) {
        // 클릭 이벤트 리스너 추가
        homeIconLink.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation(); // 이벤트 버블링 방지
            
            console.log('홈 아이콘 클릭됨');
            console.log('현재 의원 데이터:', currentMemberData);
            
            if (currentMemberData && currentMemberData.homepage) {
                console.log('홈페이지로 이동:', currentMemberData.homepage);
                window.open(currentMemberData.homepage, '_blank');
            } else {
                console.log('홈페이지 없음');
                alert('해당 국회의원의 홈페이지는 존재하지 않습니다.');
            }
        });
    }
    
    // 검색 기능
    const searchInput = document.querySelector('.search-input input');
    const searchButton = document.querySelector('.search-button');
    const searchFilter = document.querySelector('.search-filter select');

    // 검색 버튼 클릭 이벤트
    searchButton.addEventListener('click', function() {
        performSearch();
    });

    // 엔터키 검색
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // 검색 함수
    function performSearch() {
        const searchTerm = searchInput.value.trim();
        const filterValue = searchFilter.value;
        
        if (searchTerm) {
            console.log(`검색어: ${searchTerm}, 필터: ${filterValue}`);
            searchMember(searchTerm);
        }
    }

    // 의원 검색 및 정보 업데이트
    function searchMember(memberName) {
        const member = memberData[memberName];
        
        if (member) {
            updateMemberInfo(member);
        } else {
            alert('해당 의원을 찾을 수 없습니다.');
        }
    }

    // 의원 정보 업데이트
    function updateMemberInfo(member) {
        // 현재 의원 데이터 저장 (중요!)
        currentMemberData = member;
        
        // 이름 업데이트
        const memberNameElement = document.querySelector('.member-name');
        memberNameElement.textContent = `${member.name} 의원`;

        // 정당 업데이트 및 색상 적용
        const memberPartyElement = document.querySelector('.member-party');
        memberPartyElement.textContent = member.party;
        
        // 정당 색상 적용
        const partyColor = getPartyColor(member.party);
        if (partyColor) {
            memberPartyElement.style.color = partyColor;
        }

        // 사진 업데이트
        const memberPhoto = document.querySelector('.member-photo');
        memberPhoto.innerHTML = `<img src="${member.photo}" alt="${member.name} 의원 사진" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">`;

        // 순위 업데이트
        const rankings = document.querySelectorAll('.ranking');
        rankings[0].innerHTML = `전체 순위: <strong>${member.rankings.overall}위</strong>`;
        rankings[1].innerHTML = `${member.party} 내 순위: <strong>${member.rankings.party}위</strong>`;

        // 통계 업데이트
        const statItems = document.querySelectorAll('.stat-item span');
        statItems[0].textContent = `${member.stats.attendance}%`;
        statItems[1].textContent = `${member.stats.billPass}%`;
        statItems[2].textContent = `${member.stats.petitionProposal}%`;
        statItems[3].textContent = `${member.stats.petitionResult}%`;
        statItems[4].textContent = `${member.stats.abstention}%`;
        statItems[5].textContent = `${member.stats.committee}`;
        statItems[6].textContent = `${member.stats.voteMatch}%`;
        statItems[7].textContent = `${member.stats.voteMismatch}%`;

        // 통계 색상 적용
        statItems.forEach((item, index) => {
            const value = Object.values(member.stats)[index];
            if (typeof value === 'number') {
                if (index === 4 || index === 7) { // 기권, 불일치는 낮을수록 좋음
                    item.style.color = value < 10 ? '#2196F3' : '#F44336';
                } else { // 나머지는 높을수록 좋음
                    item.style.color = value > 70 ? '#2196F3' : value > 50 ? '#FF9800' : '#F44336';
                }
            }
        });
    }

    // URL 파라미터에서 의원 이름 가져오기
    function getUrlParameter(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }

    // 초기 로드시 정보 표시
    const memberNameFromUrl = getUrlParameter('name');
    if (memberNameFromUrl) {
        // URL 파라미터로 전달된 의원 정보 표시
        const member = memberData[memberNameFromUrl];
        if (member) {
            updateMemberInfo(member);
        } else {
            // 해당 의원 정보가 없는 경우 기본값
            const defaultMember = memberData["나경원"];
            if (defaultMember) {
                updateMemberInfo(defaultMember);
            }
        }
    } else {
        // URL 파라미터가 없는 경우 기본값 (나경원 의원)
        const defaultMember = memberData["나경원"];
        if (defaultMember) {
            updateMemberInfo(defaultMember);
        }
    }

    // 반응형 처리
    function handleResize() {
        const width = window.innerWidth;
        const memberProfile = document.querySelector('.member-profile');
        
        if (width <= 768) {
            memberProfile.style.flexDirection = 'column';
            memberProfile.style.alignItems = 'center';
        } else {
            memberProfile.style.flexDirection = 'row';
            memberProfile.style.alignItems = 'flex-start';
        }
    }

    // 윈도우 리사이즈 이벤트
    window.addEventListener('resize', handleResize);
    
    // 초기 실행
    handleResize();
});

// 페이지 간 이동 함수 (필요시 사용)
function navigateToPage(page) {
    console.log(`${page} 페이지로 이동`);
}

// 의원 상세 정보 로드 함수 (API 호출용)
async function loadMemberDetails(memberId) {
    try {
        // 실제 구현시에는 API 호출
        // const response = await fetch(`/api/members/${memberId}`);
        // const memberData = await response.json();
        // updateMemberInfo(memberData);
        
        console.log(`의원 ID ${memberId}의 상세 정보를 로드합니다.`);
    } catch (error) {
        console.error('의원 정보 로드 중 오류 발생:', error);
    }
}