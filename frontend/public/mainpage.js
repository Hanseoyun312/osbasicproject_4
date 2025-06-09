document.addEventListener('DOMContentLoaded', function() {
// === 전역 변수 및 상태 관리 ===
let isLoading = false;
let loadingTimeout = null;
let weightUpdateTimeout = null;
let weightChannel = null;

// 정리해야 할 이벤트 리스너들
const eventListeners = [];

// === API 연결 상태 확인 ===
function checkAPIService() {
if (typeof window.APIService === 'undefined') {
console.error('❌ APIService를 찾을 수 없습니다. global_sync.js가 로드되었는지 확인하세요.');
showError('API 서비스 연결 실패');
return false;
} else {
console.log('✅ APIService 연결됨');
return true;
}
}

// === 유틸리티 함수들 ===

// 안전한 DOM 요소 선택
function safeQuerySelector(selector) {
try {
return document.querySelector(selector);
} catch (error) {
console.warn(`DOM 선택 실패: ${selector}`, error);
return null;
}
}

// 안전한 DOM 요소 선택 (복수)
function safeQuerySelectorAll(selector) {
try {
return document.querySelectorAll(selector);
} catch (error) {
console.warn(`DOM 선택 실패: ${selector}`, error);
return [];
}
}

// 알림 표시 함수 (개선된 버전)
function showNotification(message, type = 'info') {
try {
if (window.APIService && typeof window.APIService.showNotification === 'function') {
window.APIService.showNotification(message, type);
} else {
console.log(`[${type.toUpperCase()}] ${message}`);
}
} catch (error) {
console.warn('알림 표시 실패:', error);
console.log(`[${type.toUpperCase()}] ${message}`);
}
}

// 에러 메시지 표시 (개선된 버전)
function showError(message) {
// 기존 에러 알림 제거
const existingError = safeQuerySelector('.error-notification');
if (existingError) {
existingError.remove();
}

const notification = document.createElement('div');
notification.className = 'error-notification';
notification.style.cssText = `
           position: fixed;
           top: 20px;
           right: 20px;
           background-color: #f44336;
           color: white;
           padding: 15px 20px;
           border-radius: 8px;
           font-size: 14px;
           z-index: 1000;
           box-shadow: 0 4px 12px rgba(0,0,0,0.2);
           max-width: 300px;
           word-wrap: break-word;
       `;
notification.textContent = message;

try {
document.body.appendChild(notification);
} catch (error) {
console.error('에러 알림 추가 실패:', error);
}

// 5초 후 자동 제거
setTimeout(() => {
try {
if (notification && notification.parentNode) {
notification.remove();
}
} catch (error) {
console.warn('에러 알림 제거 실패:', error);
}
}, 5000);

showNotification(message, 'error');
}

// 로딩 상태 표시 (개선된 버전)
function showLoading(show = true) {
try {
const cards = safeQuerySelectorAll('.card');
cards.forEach(card => {
if (card) {
if (show) {
card.style.opacity = '0.6';
card.style.pointerEvents = 'none';
} else {
card.style.opacity = '1';
card.style.pointerEvents = 'auto';
}
}
});

// 로딩 타임아웃 설정 (30초)
if (show) {
if (loadingTimeout) {
clearTimeout(loadingTimeout);
}
loadingTimeout = setTimeout(() => {
console.warn('로딩 타임아웃 - 강제로 로딩 상태 해제');
showLoading(false);
showError('데이터 로드 시간이 초과되었습니다.');
}, 30000);
} else {
if (loadingTimeout) {
clearTimeout(loadingTimeout);
loadingTimeout = null;
}
}
} catch (error) {
console.error('로딩 상태 변경 실패:', error);
}
}

// 정당명 정규화 (개선된 버전)
function normalizePartyName(partyName) {
if (!partyName || typeof partyName !== 'string') {
return '정보없음';
}

const trimmedName = partyName.trim();
if (!trimmedName) {
return '정보없음';
}

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

return nameMapping[trimmedName] || trimmedName;
}

// 데이터 유효성 검증
function validateData(data, type) {
if (!Array.isArray(data)) {
console.warn(`${type} 데이터가 배열이 아닙니다:`, data);
return false;
}

if (data.length === 0) {
console.warn(`${type} 데이터가 비어있습니다`);
return false;
}

return true;
}

// === API 데이터 가져오기 함수들 (개선된 버전) ===

// 정당 순위 데이터 가져오기
async function fetchPartyRankingData() {
try {
console.log('📊 정당 순위 데이터 로드 중...');

if (!window.APIService || !window.APIService.getPartyPerformance) {
throw new Error('정당 성과 API가 준비되지 않았습니다');
}

const rawData = await window.APIService.getPartyPerformance();
const partyData = rawData?.party_ranking || [];

if (!validateData(partyData, '정당')) {
console.warn('정당 데이터가 없습니다. 기본값 사용');
return getDefaultPartyRanking();
}

console.log('🔍 정당 원본 데이터 샘플:', partyData.slice(0, 2));

const processedData = partyData
.filter(party => {
return party && 
party.party && 
party.party !== '알 수 없음' && 
party.avg_total_score !== undefined && 
party.avg_total_score !== null &&
!isNaN(party.avg_total_score);
})
.map(party => {
const score = parseFloat(party.avg_total_score) || 0;
return {
name: normalizePartyName(party.party),
score: Math.round(Math.max(0, Math.min(100, score))), // 0-100 범위로 제한
originalData: party
};
})
.sort((a, b) => b.score - a.score)
.slice(0, 3);

if (processedData.length === 0) {
console.warn('처리된 정당 데이터가 없습니다. 기본값 사용');
return getDefaultPartyRanking();
}

console.log('✅ 정당 순위 데이터 가공 완료:', processedData);

return processedData.map((party, index) => ({
rank: index + 1,
name: party.name,
score: party.score
}));

} catch (error) {
console.error('❌ 정당 순위 데이터 로드 실패:', error);
return getDefaultPartyRanking();
}
}

// 국회의원 순위 데이터 가져오기
async function fetchMemberRankingData() {
try {
console.log('👥 국회의원 순위 데이터 로드 중...');

if (!window.APIService || !window.APIService.getMemberPerformance) {
throw new Error('의원 성과 API가 준비되지 않았습니다');
}

const rawData = await window.APIService.getMemberPerformance();
const memberPerformanceData = rawData?.ranking || [];

console.log('🔍 getMemberPerformance 응답 원본:', rawData);
console.log('🔍 ranking 배열:', memberPerformanceData);

if (!Array.isArray(memberPerformanceData) || memberPerformanceData.length === 0) {
console.warn('의원 성과 데이터가 없습니다. 기본값 사용');
return getDefaultMemberRanking();
}

const validMembers = memberPerformanceData.filter(member => {
const score = parseFloat(member.total_score ?? member.total_socre);
return member &&
member.lawmaker_name &&
member.lawmaker_name !== '알 수 없음' &&
!isNaN(score) &&
score > 0;
});

if (validMembers.length === 0) {
console.warn('유효한 의원 데이터가 없습니다. 기본값 사용');
return getDefaultMemberRanking();
}

const top3 = validMembers
.sort((a, b) => (parseFloat(b.total_score ?? b.total_socre) || 0) - (parseFloat(a.total_score ?? a.total_socre) || 0))
.slice(0, 3)
.map((member, index) => {
const rawScore = member.total_score ?? member.total_socre ?? 0;
const score = Math.round(parseFloat(rawScore) * 10) / 10;

console.log(`[TOP${index + 1}] ${member.lawmaker_name} (${member.party}) - ${score}%`);

return {
rank: index + 1,
name: member.lawmaker_name,
party: normalizePartyName(member.party) || '정보없음',
score: score
};
});

console.log('✅ 국회의원 순위 데이터 로드 완료:', top3);
return top3;

} catch (error) {
console.error('❌ 국회의원 순위 데이터 로드 실패:', error);
return getDefaultMemberRanking();
}
}


// 기본 데이터
function getDefaultPartyRanking() {
return [
{ rank: 1, name: '더불어민주당', score: 87.1 },
{ rank: 2, name: '진보당', score: 85.9 },
{ rank: 3, name: '조국혁신당', score: 81.9 }
];
}

function getDefaultMemberRanking() {
return [
{ rank: 1, name: '어기구', party: '더불어민주당', score: 94 },
{ rank: 2, name: '이건태', party: '더불어민주당', score: 91 },
{ rank: 3, name: '박성준', party: '더불어민주당', score: 88 }
];
}

// === UI 업데이트 함수들 (개선된 버전) ===

// 정당 순위 카드 업데이트
function updatePartyRankingCard(partyData) {
try {
if (!validateData(partyData, '정당 순위')) {
console.error('❌ 유효하지 않은 정당 데이터');
return;
}

const partyCard = safeQuerySelector('.card:first-child');
if (!partyCard) {
console.error('❌ 정당 순위 카드를 찾을 수 없습니다');
return;
}

const rankingList = partyCard.querySelector('.ranking-list');
if (!rankingList) {
console.error('❌ 정당 순위 리스트를 찾을 수 없습니다');
return;
}

// 기존 내용 비우기
rankingList.innerHTML = '';

partyData.forEach((party, index) => {
if (!party || !party.name) {
console.warn('유효하지 않은 정당 데이터 스킵:', party);
return;
}

const rankingItem = document.createElement('li');
rankingItem.className = 'ranking-item';

const rank = party.rank || (index + 1);
const name = String(party.name || '정보없음');
const score = Math.round(party.score || 0);

rankingItem.innerHTML = `
                   <div class="rank-number">${rank}</div>
                   <div class="info">
                       <div class="name">${name}</div>
                   </div>
                   <div class="percentage">${score}%</div>
               `;

rankingList.appendChild(rankingItem);
});

console.log('✅ 정당 순위 카드 업데이트 완료');
} catch (error) {
console.error('❌ 정당 순위 카드 업데이트 실패:', error);
}
}

// 국회의원 순위 카드 업데이트
function updateMemberRankingCard(memberData) {
try {
if (!validateData(memberData, '의원 순위')) {
console.error('❌ 유효하지 않은 의원 데이터');
return;
}

const memberCard = safeQuerySelector('.card:last-child');
if (!memberCard) {
console.error('❌ 국회의원 순위 카드를 찾을 수 없습니다');
return;
}

const rankingList = memberCard.querySelector('.ranking-list');
if (!rankingList) {
console.error('❌ 국회의원 순위 리스트를 찾을 수 없습니다');
return;
}

// 기존 내용 비우기
rankingList.innerHTML = '';

memberData.forEach((member, index) => {
if (!member || !member.name) {
console.warn('유효하지 않은 의원 데이터 스킵:', member);
return;
}

const rankingItem = document.createElement('li');
rankingItem.className = 'ranking-item';

const rank = member.rank || (index + 1);
const name = String(member.name || '정보없음');
const party = String(member.party || '정보없음');
// 중복 선언 오류 수정: 하나의 score 변수만 사용
const score = Math.round(parseFloat(member.score) * 10) / 10; 

rankingItem.innerHTML = `
                   <div class="rank-number">${rank}</div>
                   <div class="info">
                       <div class="name">${name}</div>
                       <div class="party-name">${party}</div>
                   </div>
                   <div class="percentage">${score}%</div>
               `;

rankingList.appendChild(rankingItem);
});

console.log('✅ 국회의원 순위 카드 업데이트 완료');
} catch (error) {
console.error('❌ 국회의원 순위 카드 업데이트 실패:', error);
}
}

// === 메인 데이터 로드 함수 (개선된 버전) ===
async function loadMainPageData() {
if (!checkAPIService()) {
console.warn('⚠️ APIService 없음 - 기본 데이터 사용');
updatePartyRankingCard(getDefaultPartyRanking());
updateMemberRankingCard(getDefaultMemberRanking());
return;
}

if (isLoading) {
console.log('🔄 이미 로딩 중입니다');
return;
}

console.log('🚀 메인페이지 데이터 로드 시작...');

try {
isLoading = true;
showLoading(true);

// Promise.allSettled로 안전하게 동시 로드
const [partyResult, memberResult] = await Promise.allSettled([
fetchPartyRankingData(),
fetchMemberRankingData()
]);

// 정당 순위 업데이트
if (partyResult.status === 'fulfilled' && partyResult.value) {
updatePartyRankingCard(partyResult.value);
console.log('✅ 정당 순위 업데이트 성공');
} else {
console.warn('정당 순위 로드 실패, 기본값 사용:', partyResult.reason);
updatePartyRankingCard(getDefaultPartyRanking());
}

// 국회의원 순위 업데이트
if (memberResult.status === 'fulfilled' && memberResult.value) {
updateMemberRankingCard(memberResult.value);
console.log('✅ 실제 API 데이터로 명예의 의원 업데이트 완료');
} else {
console.warn('국회의원 순위 로드 실패, 기본값 사용:', memberResult.reason);
updateMemberRankingCard(getDefaultMemberRanking());
}

showNotification('메인페이지 데이터 로드 완료', 'success');
console.log('✅ 메인페이지 데이터 로드 완료');

} catch (error) {
console.error('❌ 메인페이지 데이터 로드 실패:', error);

// 기본 데이터로 폴백
updatePartyRankingCard(getDefaultPartyRanking());
updateMemberRankingCard(getDefaultMemberRanking());

showError('데이터 로드에 실패했습니다. 기본 데이터를 표시합니다.');
} finally {
isLoading = false;
showLoading(false);
}
}

// === 가중치 변경 감지 시스템 (개선된 버전) ===

function setupWeightChangeListener() {
try {
console.log('[MainPage] 🔄 가중치 변경 감지 시스템 설정...');

// 1. localStorage 이벤트 감지
const storageHandler = function(event) {
if (event.key === 'weight_change_event' && event.newValue) {
try {
const changeData = JSON.parse(event.newValue);
console.log('[MainPage] 📢 가중치 변경 감지:', changeData);
handleWeightUpdate(changeData, 'localStorage');
} catch (e) {
console.warn('[MainPage] 가중치 변경 데이터 파싱 실패:', e);
}
}
};

window.addEventListener('storage', storageHandler);
eventListeners.push({ element: window, event: 'storage', handler: storageHandler });

// 2. BroadcastChannel 감지 (최신 브라우저)
if (typeof BroadcastChannel !== 'undefined') {
try {
weightChannel = new BroadcastChannel('weight_updates');

const channelHandler = function(event) {
console.log('[MainPage] 📡 BroadcastChannel 가중치 변경 감지:', event.data);
handleWeightUpdate(event.data, 'BroadcastChannel');
};

weightChannel.addEventListener('message', channelHandler);

console.log('[MainPage] ✅ BroadcastChannel 설정 완료');
} catch (e) {
console.warn('[MainPage] BroadcastChannel 설정 실패:', e);
}
}

// 3. 커스텀 이벤트 감지
const customEventHandler = function(event) {
console.log('[MainPage] 🎯 커스텀 이벤트 가중치 변경 감지:', event.detail);
handleWeightUpdate(event.detail, 'customEvent');
};

document.addEventListener('weightSettingsChanged', customEventHandler);
eventListeners.push({ element: document, event: 'weightSettingsChanged', handler: customEventHandler });

// 4. 주기적 체크
let lastWeightCheckTime = localStorage.getItem('last_weight_update') || '0';
const periodicCheck = setInterval(function() {
try {
const currentCheckTime = localStorage.getItem('last_weight_update') || '0';

if (currentCheckTime !== lastWeightCheckTime && currentCheckTime !== '0') {
console.log('[MainPage] ⏰ 주기적 체크로 가중치 변경 감지');
lastWeightCheckTime = currentCheckTime;

const changeData = {
type: 'weights_updated',
timestamp: new Date(parseInt(currentCheckTime)).toISOString(),
source: 'periodic_check'
};

handleWeightUpdate(changeData, 'periodicCheck');
}
} catch (error) {
console.warn('[MainPage] 주기적 체크 중 오류:', error);
}
}, 5000);

// 정리를 위한 참조 저장
eventListeners.push({ type: 'interval', handler: periodicCheck });

console.log('[MainPage] ✅ 가중치 변경 감지 시스템 설정 완료');

} catch (error) {
console.error('[MainPage] ❌ 가중치 변경 감지 시스템 설정 실패:', error);
}
}

// 가중치 업데이트 처리
async function handleWeightUpdate(changeData, source) {
try {
if (isLoading) {
console.log('[MainPage] 🔄 이미 로딩 중이므로 가중치 업데이트 스킵');
return;
}

console.log(`[MainPage] 🔄 가중치 업데이트 처리 시작 (${source})`);

// 기존 타임아웃 취소
if (weightUpdateTimeout) {
clearTimeout(weightUpdateTimeout);
}

showNotification('가중치가 변경되었습니다. 총 점수를 다시 계산하여 메인페이지를 새로고침합니다...', 'info');

// 서버에서 total_score 재계산 시간을 고려한 딜레이
weightUpdateTimeout = setTimeout(async () => {
try {
await loadMainPageData();

console.log('[MainPage] ✅ 가중치 업데이트 완료 - total_score 기반');
showNotification('새로운 가중치가 적용되어 총 점수가 업데이트되었습니다! 🎉', 'success');

// 응답 전송
try {
const response = {
page: 'mainpage.html',
timestamp: new Date().toISOString(),
success: true,
source: source,
scoreFieldsUpdated: ['total_score']
};
localStorage.setItem('weight_refresh_response', JSON.stringify(response));
setTimeout(() => {
try {
localStorage.removeItem('weight_refresh_response');
} catch (e) {
console.warn('[MainPage] 응답 제거 실패:', e);
}
}, 100);
} catch (e) {
console.warn('[MainPage] 응답 전송 실패:', e);
}

} catch (error) {
console.error('[MainPage] ❌ 가중치 업데이트 데이터 로드 실패:', error);
showNotification('가중치 업데이트에 실패했습니다. 다시 시도해주세요.', 'error');
}
}, 5000);

} catch (error) {
console.error('[MainPage] ❌ 가중치 업데이트 처리 실패:', error);
showNotification('가중치 업데이트 처리에 실패했습니다.', 'error');
}
}

// === 네비게이션 및 이벤트 설정 (개선된 버전) ===

function setupNavigation() {
try {
// 더보기 버튼들
const showMoreButtons = safeQuerySelectorAll('.show-more');

showMoreButtons.forEach((button, index) => {
if (button) {
const clickHandler = function() {
if (index === 0) {
window.location.href = 'rank_party.html';
} else if (index === 1) {
window.location.href = 'rank_member.html';
}
};

button.addEventListener('click', clickHandler);
eventListeners.push({ element: button, event: 'click', handler: clickHandler });
}
});

// 상세 퍼센트 링크
const percentLink = safeQuerySelector('.percentages-container .more-link');
if (percentLink) {
const percentClickHandler = function() {
window.location.href = 'percent.html';
};

percentLink.addEventListener('click', percentClickHandler);
percentLink.style.cursor = 'pointer';
eventListeners.push({ element: percentLink, event: 'click', handler: percentClickHandler });
}

// 공지사항 링크
const noticeLink = safeQuerySelector('.notices-container .more-link');
if (noticeLink) {
const noticeClickHandler = function() {
window.location.href = 'announcements.html';
};

noticeLink.addEventListener('click', noticeClickHandler);
noticeLink.style.cursor = 'pointer';
eventListeners.push({ element: noticeLink, event: 'click', handler: noticeClickHandler });
}

console.log('✅ 네비게이션 설정 완료');
} catch (error) {
console.error('❌ 네비게이션 설정 실패:', error);
}
}

// === 팝업 관련 함수들 (기존 유지) ===

function shouldShowImagePopup() {
try {
const today = new Date().toDateString();
const hiddenDate = localStorage.getItem('imagePopupHiddenDate');
return hiddenDate !== today;
} catch (error) {
console.warn('localStorage 접근 불가:', error);
return true;
}
}

function shouldShowPercentPopup() {
try {
const today = new Date().toDateString();
const hiddenDate = localStorage.getItem('percentPopupHiddenDate');
return hiddenDate !== today;
} catch (error) {
console.warn('localStorage 접근 불가:', error);
return true;
}
}

// 팝업 모달 생성 함수 (기존 유지하되 에러 처리 개선)
function createPopupModal(content, callback, showDontShowToday = false, storageKey = 'popupHiddenDate') {
console.log('팝업 생성:', storageKey);

let isAnimating = false;

try {
// 배경 오버레이
const backdrop = document.createElement('div');
backdrop.style.cssText = `
               position: fixed;
               top: 0;
               left: 0;
               width: 100%;
               height: 100%;
               background: rgba(0,0,0,0);
               z-index: 9999;
               transition: background-color 0.3s ease;
           `;

// 팝업 모달
const popup = document.createElement('div');
popup.style.cssText = `
               position: fixed;
               top: 50%;
               left: 50%;
               transform: translate(-50%, -50%) scale(0.8);
               background: white;
               padding: 30px;
               border-radius: 15px;
               box-shadow: 0 10px 30px rgba(0,0,0,0.3);
               z-index: 10000;
               max-width: 500px;
               width: 90%;
               max-height: 80vh;
               overflow-y: auto;
               opacity: 0;
               transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
               scrollbar-width: none;
               -ms-overflow-style: none;
           `;

popup.style.setProperty('-webkit-scrollbar', 'none', 'important');

const dontShowTodayHtml = showDontShowToday ? `
               <div style="margin: 20px 0; text-align: center;">
                   <label style="display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; font-size: 14px; color: #888;">
                       <input type="checkbox" id="dontShowToday" style="margin: 0;">
                       <span>오늘 하루 그만보기</span>
                   </label>
               </div>
           ` : '';

popup.innerHTML = `
               <div style="margin-bottom: 25px;">
                   ${content}
               </div>
               ${dontShowTodayHtml}
               <div style="text-align: center; margin-top: 25px;">
                   <button id="confirmBtn" style="
                       padding: 12px 30px; 
                       background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); 
                       color: white; 
                       border: none; 
                       border-radius: 25px; 
                       cursor: pointer; 
                       font-size: 16px; 
                       font-weight: 500;
                       transition: transform 0.2s ease;
                       box-shadow: 0 4px 15px rgba(79, 172, 254, 0.3);
                   ">
                       확인
                   </button>
               </div>
           `;

document.body.appendChild(backdrop);
document.body.appendChild(popup);

// 애니메이션
requestAnimationFrame(() => {
requestAnimationFrame(() => {
backdrop.style.backgroundColor = 'rgba(0,0,0,0.6)';
popup.style.opacity = '1';
popup.style.transform = 'translate(-50%, -50%) scale(1)';
});
});

const confirmBtn = popup.querySelector('#confirmBtn');
if (confirmBtn) {
confirmBtn.onmouseover = () => confirmBtn.style.transform = 'translateY(-2px)';
confirmBtn.onmouseout = () => confirmBtn.style.transform = 'translateY(0)';
}

function closePopup() {
if (isAnimating) return;
isAnimating = true;

if (showDontShowToday) {
const dontShowCheckbox = popup.querySelector('#dontShowToday');
if (dontShowCheckbox && dontShowCheckbox.checked) {
try {
const today = new Date().toDateString();
localStorage.setItem(storageKey, today);
console.log(`${storageKey} 숨김 설정 저장:`, today);
} catch (error) {
console.warn('localStorage 저장 실패:', error);
}
}
}

backdrop.style.backgroundColor = 'rgba(0,0,0,0)';
popup.style.opacity = '0';
popup.style.transform = 'translate(-50%, -50%) scale(0.8)';

function onTransitionEnd(e) {
if (e.target === popup && e.propertyName === 'opacity') {
popup.removeEventListener('transitionend', onTransitionEnd);

try {
if (popup.parentNode) popup.remove();
if (backdrop.parentNode) backdrop.remove();
console.log('팝업 완전히 제거됨');

if (callback) {
setTimeout(callback, 50);
}
} catch (error) {
console.error('팝업 제거 중 오류:', error);
}
}
}

popup.addEventListener('transitionend', onTransitionEnd);

setTimeout(() => {
if (popup.parentNode || backdrop.parentNode) {
console.warn('애니메이션 타임아웃, 강제 제거');
popup.removeEventListener('transitionend', onTransitionEnd);
if (popup.parentNode) popup.remove();
if (backdrop.parentNode) backdrop.remove();
if (callback) callback();
}
}, 1000);
}

if (confirmBtn) {
confirmBtn.onclick = closePopup;
}

backdrop.onclick = (e) => {
if (e.target === backdrop) {
console.log('배경 클릭으로 팝업 닫음');
closePopup();
}
};

return { backdrop, popup };

} catch (error) {
console.error('팝업 생성 중 오류:', error);
return null;
}
}

// 팝업 표시 함수들 (기존 유지)
function showImageSourcePopup(callback) {
createPopupModal(`
           <div style="text-align: center; margin-bottom: 20px;">
               <div style="font-size: 48px; margin-bottom: 10px;">📸</div>
               <h3 style="color: #4facfe; margin-bottom: 20px;">이미지 출처 안내</h3>
           </div>
           
           <p style="margin-bottom: 15px; line-height: 1.6;">
               안녕하세요! <strong>백일하</strong> 서비스를 이용해 주셔서 감사합니다.
           </p>
           
           <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
               <p style="margin-bottom: 15px;">
                   저희가 사용하는 모든 이미지는 다음 출처에서 가져왔음을 명시합니다:
               </p>
               
               <div style="margin: 15px 0;">
                   <h4 style="color: #4facfe; margin-bottom: 8px;">👤 국회의원 사진</h4>
                   <p style="font-size: 14px;">열린국회정보 OpenAPI 제공 자료 활용</p>
               </div>
           </div>
           
           <p style="text-align: center; font-size: 14px; color: #888; margin-top: 20px;">
               저희는 비상업적 교육 목적으로 제작되었으며,<br>
               어떤 정당이나 의원에 대한 편견이 없음을 알려드립니다.
           </p>
       `, callback, true, 'imagePopupHiddenDate');
}

function showPercentGuidePopup() {
createPopupModal(`
           <div style="text-align: center; margin-bottom: 20px;">
               <div style="font-size: 48px; margin-bottom: 10px;">📊</div>
               <h3 style="color: #4facfe; margin-bottom: 20px;">상세 퍼센트 기능</h3>
           </div>
           
           <p style="margin-bottom: 20px; line-height: 1.6; text-align: center;">
               <strong>백일하</strong>만의 특별한 기능을 소개합니다!
           </p>
           
           <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 20px; border-radius: 10px; margin: 20px 0;">
               <h4 style="color: #4facfe; margin-bottom: 15px; text-align: center;">🎯 상세 퍼센트란?</h4>
               
               <div style="margin: 15px 0;">
                   <p style="margin-bottom: 10px;"><strong>✅ 출석률</strong> - 국회 본회의 참석 현황</p>
                   <p style="margin-bottom: 10px;"><strong>📋 법안 발의율</strong> - 의원별 법안 제출 활동</p>
                   <p style="margin-bottom: 10px;"><strong>🗳️ 투표 참여율</strong> - 안건별 투표 참여도</p>
                   <p style="margin-bottom: 10px;"><strong>💬 질의 활동</strong> - 국정감사 및 질의 횟수</p>
                   <p style="margin-bottom: 10px;"><strong>👑 위원장 경력</strong> - 상임위원회 위원장 활동 비율</p>
               </div>
           </div>
           
           <div style="text-align: center; margin: 20px 0;">
               <p style="font-size: 16px; margin-bottom: 10px;">
                   <strong>다양한 기준으로 의원과 정당을 비교해보세요!</strong>
               </p>
               <p style="font-size: 14px; color: #888;">
                   하단의 "상세 퍼센트" 메뉴에서 확인할 수 있습니다.
               </p>
           </div>
       `, null, true, 'percentPopupHiddenDate');
}

// 공지사항 관련 함수들 (기존 유지하되 에러 처리 개선)
const noticeDataMap = {
'제21대 대통령선거 당선으로 인한 의원 안내': {
date: '2025.06.04',
title: '제21대 대통령선거 당선으로 인한 의원 안내'
},
'제21대 대통령선거 출마 의원 제외 안내': {
date: '2025.05.26',
title: '제21대 대통령선거 출마 의원 제외 안내'
},
'국회의원 사진 출처 안내': {
date: '2025.05.25',
title: '국회의원 사진 출처 안내'
}
};

function setupNoticeClickEvents() {
try {
const noticeItems = safeQuerySelectorAll('.notices-list li');

noticeItems.forEach(item => {
if (item) {
item.style.cursor = 'pointer';
item.style.transition = 'background-color 0.2s ease';

const hoverEnterHandler = function() {
this.style.backgroundColor = 'var(--main2)';
};
const hoverLeaveHandler = function() {
this.style.backgroundColor = 'transparent';
};
const clickHandler = function() {
const title = this.textContent.trim();
const noticeData = noticeDataMap[title];

if (noticeData) {
showAnnouncementDetail(noticeData.title, noticeData.date);
}
};

item.addEventListener('mouseenter', hoverEnterHandler);
item.addEventListener('mouseleave', hoverLeaveHandler);
item.addEventListener('click', clickHandler);

eventListeners.push({ element: item, event: 'mouseenter', handler: hoverEnterHandler });
eventListeners.push({ element: item, event: 'mouseleave', handler: hoverLeaveHandler });
eventListeners.push({ element: item, event: 'click', handler: clickHandler });
}
});
} catch (error) {
console.error('공지사항 클릭 이벤트 설정 실패:', error);
}
}

function showAnnouncementDetail(title, date) {
try {
// 기존 모달 제거
const existingModal = safeQuerySelector('.announcement-detail-modal');
const existingBackdrop = safeQuerySelector('#modalBackdrop');
if (existingModal) existingModal.remove();
if (existingBackdrop) existingBackdrop.remove();

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

let content = '';
switch(title) {
case '제21대 대통령선거 당선으로 인한 의원 안내':
content = `
                       <p style="margin-bottom: 15px;">안녕하세요, 백일하 서비스를 이용해 주시는 여러분께 감사드립니다.</p>
                       <p style="margin-bottom: 15px;">2025년 06월 03일에 실시하는 제21대 대통령선거 당선을 진심으로 축하드립니다.</p>

                       <h4 style="color: var(--string); margin: 20px 0 10px;">더불어민주당</h4>
                       <p style="margin-bottom: 15px;">이재명</p>

                       <p style="margin-bottom: 15px;">다음 의원의 데이터가 추가되었습니다.</p>
                       <h4 style="color: var(--string); margin: 20px 0 10px;">개혁신당</h4>
                       <p style="margin-bottom: 15px;">이준석</p>

                       <p style="margin-bottom: 15px;">이재명 대통령 당선으로 현재 총 국회의원석은 299명입니다.</p>
                   `;
break;
case '제21대 대통령선거 출마 의원 제외 안내':
content = `
                       <p style="margin-bottom: 15px;">안녕하세요, 백일하 서비스를 이용해 주시는 여러분께 감사드립니다.</p>
                       <p style="margin-bottom: 15px;">2025년 06월 03일에 실시하는 제21대 대통령선거 출마로 다음 의원의 정보가 제외됬었음을 알립니다.</p>
                       
                       <h4 style="color: var(--string); margin: 20px 0 10px;">더불어민주당</h4>
                       <p style="margin-bottom: 15px;">이재명</p>
                       <h4 style="color: var(--string); margin: 20px 0 10px;">개혁신당</h4>
                       <p style="margin-bottom: 15px;">이준석</p>
                   `;
break;
case '국회의원 사진 출처 안내':
content = `
                       <p style="margin-bottom: 15px;">안녕하세요, 백일하 서비스를 이용해 주시는 여러분께 감사드립니다.</p>
                       <p style="margin-bottom: 15px;">저희가 사용하는 사진들은 각 주소에서 가져왔음을 명시합니다.</p>
                       <p style="margin-bottom: 15px;">저희는 어느 정당에 대한 악의가 없으며 비상업적 교육 목적으로 제작되었음을 알립니다.</p>
                       
                       <h4 style="color: var(--string); margin: 20px 0 10px;">국회의원 사진</h4>
                       <p style="margin-bottom: 15px;">열린국회정보 OpenAPI에서 제공하는 국회의원 사진을 사용하였습니다.</p>
                   `; 
break;
default:
content = `<p>공지사항 내용이 준비 중입니다.</p>`;
}

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
} catch (error) {
console.error('공지사항 상세 표시 실패:', error);
}
}

// === 리소스 정리 함수 ===
function cleanup() {
try {
console.log('🧹 리소스 정리 중...');

// 이벤트 리스너 정리
eventListeners.forEach(listener => {
try {
if (listener.type === 'interval') {
clearInterval(listener.handler);
} else if (listener.element && listener.event && listener.handler) {
listener.element.removeEventListener(listener.event, listener.handler);
}
} catch (error) {
console.warn('이벤트 리스너 정리 실패:', error);
}
});

// 타임아웃 정리
if (loadingTimeout) {
clearTimeout(loadingTimeout);
loadingTimeout = null;
}

if (weightUpdateTimeout) {
clearTimeout(weightUpdateTimeout);
weightUpdateTimeout = null;
}

// BroadcastChannel 정리
if (weightChannel) {
try {
weightChannel.close();
weightChannel = null;
} catch (error) {
console.warn('BroadcastChannel 정리 실패:', error);
}
}

console.log('✅ 리소스 정리 완료');
} catch (error) {
console.error('❌ 리소스 정리 실패:', error);
}
}

// === 외부 API 함수들 ===

// 수동 새로고침 함수들
window.refreshMainPageData = function() {
console.log('[MainPage] 🔄 수동 새로고침 요청');
return loadMainPageData();
};

// WeightSync 호환 함수들
window.refreshMemberDetails = function() {
console.log('[MainPage] 🔄 의원 데이터 새로고침 (WeightSync 호환)');
return loadMainPageData();
};

window.refreshPartyRanking = function() {
console.log('[MainPage] 🔄 정당 데이터 새로고침 (WeightSync 호환)');
return loadMainPageData();
};

// === 디버깅 함수들 ===

window.debugPopup = {
checkStatus: () => {
const today = new Date().toDateString();
const imageHidden = localStorage.getItem('imagePopupHiddenDate');
const percentHidden = localStorage.getItem('percentPopupHiddenDate');

console.log('=== 팝업 상태 ===');
console.log('오늘 날짜:', today);
console.log('이미지 팝업 숨김 날짜:', imageHidden);
console.log('퍼센트 팝업 숨김 날짜:', percentHidden);
console.log('이미지 팝업 표시 여부:', imageHidden !== today);
console.log('퍼센트 팝업 표시 여부:', percentHidden !== today);
},
resetImagePopup: () => {
localStorage.removeItem('imagePopupHiddenDate');
console.log('이미지 팝업 설정 초기화됨');
},
resetPercentPopup: () => {
localStorage.removeItem('percentPopupHiddenDate');
console.log('퍼센트 팝업 설정 초기화됨');
},
resetAllPopups: () => {
localStorage.removeItem('imagePopupHiddenDate');
localStorage.removeItem('percentPopupHiddenDate');
console.log('모든 팝업 설정 초기화됨');
}
};

window.mainPageDebug = {
reloadData: () => loadMainPageData(),
refreshData: () => loadMainPageData(),

checkAPIStructure: async () => {
console.log('🔍 API 구조 확인 중...');
try {
if (!checkAPIService()) {
console.error('API 서비스가 준비되지 않음');
return;
}

const [partyData, memberData] = await Promise.all([
window.APIService.getPartyPerformance(),
window.APIService.getMemberPerformance()
]);

console.log('📊 정당 API 응답 샘플:', partyData?.slice(0, 2));
console.log('👤 의원 API 응답 샘플:', memberData?.slice(0, 2));

if (partyData && partyData.length > 0) {
const party = partyData[0];
console.log('정당 필드 확인:', {
party: party.party,
avg_total_score: party.avg_total_score
});
}

if (memberData && memberData.length > 0) {
const member = memberData[0];
console.log('의원 필드 확인:', {
lawmaker_name: member.lawmaker_name,
party: member.party,
total_score: member.total_score
});
}

} catch (error) {
console.error('API 구조 확인 실패:', error);
}
},

showInfo: () => {
console.log('📊 메인페이지 정보:');
console.log('- API 서비스:', !!window.APIService);
console.log('- 로딩 상태:', isLoading);
console.log('- API 준비 상태:', window.APIService?._isReady);
console.log('- 이벤트 리스너 수:', eventListeners.length);
},

testNewAPIMapping: async () => {
console.log('🧪 새로운 API 매핑 테스트...');
try {
const partyRanking = await fetchPartyRankingData();
const memberRanking = await fetchMemberRankingData();

console.log('✅ 가공된 정당 순위:', partyRanking);
console.log('✅ 가공된 의원 순위:', memberRanking);

return { partyRanking, memberRanking };
} catch (error) {
console.error('❌ API 매핑 테스트 실패:', error);
}
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

cleanup: cleanup
};

// === 초기화 실행 ===

try {
// API 서비스 확인
if (checkAPIService()) {
// API 데이터 로드 (팝업보다 늦게 실행)
setTimeout(loadMainPageData, 1500);
}

// 네비게이션 설정
setupNavigation();

// 공지사항 클릭 이벤트 설정
setupNoticeClickEvents();

// 가중치 변경 감지 시스템 설정
setupWeightChangeListener();

// 팝업 표시 (개별 확인)
setTimeout(() => {
try {
if (shouldShowImagePopup()) {
showImageSourcePopup(() => {
if (shouldShowPercentPopup()) {
showPercentGuidePopup();
}
});
} else if (shouldShowPercentPopup()) {
showPercentGuidePopup();
}
} catch (error) {
console.error('팝업 표시 중 오류:', error);
}
}, 1000);

// 페이지 언로드 시 정리
const beforeUnloadHandler = function() {
cleanup();
};

window.addEventListener('beforeunload', beforeUnloadHandler);
eventListeners.push({ element: window, event: 'beforeunload', handler: beforeUnloadHandler });

console.log('✅ 메인페이지 스크립트 로드 완료 (개선된 안정성)');
console.log('🎯 디버깅: window.mainPageDebug.showInfo()');
console.log('🧪 API 테스트: window.mainPageDebug.testNewAPIMapping()');

} catch (error) {
console.error('❌ 메인페이지 초기화 실패:', error);
showError('페이지 초기화에 실패했습니다.');
}
});
