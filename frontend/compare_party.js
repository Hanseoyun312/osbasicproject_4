// 선택된 정당을 저장할 변수
let selectedParties = [];

// 정당별 데이터
const partyData = {
    "더불어 민주당": {
        winColor: "#152484",
        loseColor: "#15248480" // 50% 투명도
    },
    "국민의 힘": {
        winColor: "#E61E2B",
        loseColor: "#E61E2B80" // 50% 투명도
    },
    "조국혁신당": {
        winColor: "#06275E",
        loseColor: "#0073CF"
    },
    "개혁신당": {
        winColor: "#FF7210", 
        loseColor: "#FF721080" // 50% 투명도
    },
    "진보당": {
        winColor: "#D6001C",
        loseColor: "#D6001C80" // 50% 투명도
    },
    "기본소득당": {
        winColor: "#091E3A",
        loseColor: "#00D2C3"
    },
    "사회민주당": {
        winColor: "#43A213",
        loseColor: "#F58400"
    },
    "무소속": {
        winColor: "#4B5563",
        loseColor: "#9CA3AF"
    }
};


// DOM이 완전히 로드된 후 스크립트 실행
document.addEventListener('DOMContentLoaded', function() {    
    // 드롭다운 변경 시 이벤트 처리
    const dropdowns = document.querySelectorAll('select.party-dropdown');
    
    dropdowns.forEach((dropdown, index) => {
        dropdown.addEventListener('change', function() {
            const selectedParty = this.value;
            console.log('선택된 정당:', selectedParty);
            
            // 이미 선택된 정당인지 확인
            if (selectedParties.includes(selectedParty) && selectedParty !== "") {
                alert("이미 다른 칸에서 선택된 정당입니다. 다른 정당을 선택해주세요.");
                this.value = selectedParties[index] || ""; // 이전 값으로 복원
                return;
            }
            
            // 선택된 정당 업데이트
            selectedParties[index] = selectedParty;
            
            // 다른 드롭다운에서 이미 선택된 정당 비활성화
            dropdowns.forEach((otherDropdown, otherIndex) => {
                if (otherIndex !== index) {
                    Array.from(otherDropdown.options).forEach(option => {
                        if (selectedParties.includes(option.value) && option.value !== selectedParties[otherIndex] && option.value !== "") {
                            option.disabled = true;
                        } else {
                            option.disabled = false;
                        }
                    });
                }
            });
            
            // 선택된 정당에 따라 스타일 변경
            if (selectedParty && partyData[selectedParty]) {
                // 해당 카드 내의 WIN, LOSE 요소 색상 변경
                const card = dropdown.closest('.comparison-card');
                const winElements = card.querySelectorAll('.win');
                const loseElements = card.querySelectorAll('.lose');
                
                winElements.forEach(el => {
                    el.style.color = partyData[selectedParty].winColor;
                });
                
                loseElements.forEach(el => {
                    el.style.color = partyData[selectedParty].loseColor;
                });
            }

            fetchAndShowComparison();

        });
    });
});

// [2] 두 정당 선택시 비교 API 호출해서 결과를 뿌리는 함수
function fetchAndShowComparison() {
    // 두 정당 모두 선택됐는지 체크
    if (selectedParties[0] && selectedParties[1]) {
        fetch(`https://baekilha.onrender.com/compare_parties/?party1=${encodeURIComponent(selectedParties[0])}&party2=${encodeURIComponent(selectedParties[1])}`)
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    alert(data.error);
                    return;
                }
                // 카드 데이터 업데이트!
                updateComparisonCards(data);
            })
            .catch(err => {
                alert("데이터를 불러오지 못했습니다.");
                console.error(err);
            });
    }
}

// [3] 받아온 데이터를 각 카드에 반영하는 함수
function updateComparisonCards(data) {
    const cards = document.querySelectorAll('.comparison-card');
    const parties = selectedParties;

    // 순위 표시
    cards.forEach((card, idx) => {
        const party = parties[idx];
        if (!party || !data['순위']) return;
        // status-item 중 '현재 순위'에만 값 넣기
        const rankElem = card.querySelectorAll('.status-item .status-value')[0];
        if (rankElem) {
            rankElem.textContent = `${data['순위'][party]}위`;
        }
    });

    // === 중요: 필드 순서 매칭 (html에 맞게) ===
    // 아래 순서는 html 각 status-item 순서와 views.py의 필드명을 연결한 것!
    const fieldOrder = [
        "출석_평균",         // 출석
        "법안가결_총합",     // 본회의 가결
        "청원제시_총합",     // 청원 제안
        "청원결과_총합",     // 청원 결과
        "위원회_총합",       // 위원장
        "기권무효_평균",     // 무효표 및 기권
        "표결일치_평균",     // 투표 결과 일치
        "표결불일치_평균"    // 투표 결과 불일치
    ];

    cards.forEach((card, idx) => {
        const party = parties[idx];
        if (!party || !data['비교항목']) return;
        // status-value: 0=순위, 1=출석, 2=본회의 가결, 3=청원 제안, ... 
        const statusValues = card.querySelectorAll('.status-item .status-value');
        fieldOrder.forEach((field, i) => {
            if (!statusValues[i+1]) return; // statusValues[0]은 '순위'
            const fieldData = data['비교항목'][field];
            if (!fieldData) {
                statusValues[i+1].innerHTML = "정보없음";
            } else {
                // 값(%)처럼 보이게 하려면 필요한 포맷으로 변환 (원하면 수정!)
                let value = fieldData[party];
                statusValues[i+1].innerHTML = value !== undefined && value !== null ? value : "정보없음";
            }
        });
    });
}