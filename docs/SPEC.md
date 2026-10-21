Personal Dashboard Web App - Project Spec (UI Skeleton Only)
1. Project Overview
목표: 업무, 취미, 투자, 일정 관리를 위한 개인용 대시보드의 UI 뼈대(레이아웃)만 구축.
기술 스택: Vite (React), Tailwind CSS, React Router DOM.
디자인 원칙:
완전한 다크모드 (Deep Gray: bg-gray-900, 컴포넌트: bg-gray-800).
더미 데이터 없이 각 영역이 어떤 역할을 하는지 텍스트 라벨(Placeholder)로만 표시할 것.
2. Directory Structure (폴더 구조)
프로젝트는 정확히 아래 구조를 따르며, 불필요한 폴더(예: views, styles)는 생성하지 않는다.

src/components/: Layout.jsx, Sidebar.jsx, BottomTab.jsx, Header.jsx, WidgetBox.jsx
src/pages/: Home.jsx, Schedule.jsx, Work.jsx, Hobbies.jsx, Investments.jsx
3. Core UI Layout
Navigation (반응형 메뉴):
데스크톱(lg 이상): 좌측 고정 Sidebar (너비 250px).
모바일: 하단 고정 BottomTab (앱 스타일).
메뉴 아이템 5개: Home, Schedule, Work, Hobbies, Investments
Header (상단): 현재 페이지 타이틀 표시.
FAB (플로팅 버튼): 우측 하단 고정. '새 항목 추가' 모달 창 띄우기용. (모바일 하단 탭과 겹치지 않게 여백 넉넉히)
Home Page (메인 화면):
WidgetBox 4개 배치 (Schedule, Work, Hobbies, Investments).
레이아웃: PC는 Grid 배치(2x2 등 유연하게), 모바일은 세로 1열.
내용은 오직 "여기에 [카테고리] 데이터 영역" 텍스트만 표시.
4. Claude Code Execution Rules (AI 에이전트 절대 규칙)
에이전트는 코드 작성 시 반드시 다음 규칙을 최우선으로 준수해야 한다.

Strict UI Skeleton Only (데이터/로직 구현 절대 금지):
Supabase 연결, 외부 API Fetch, 복잡한 JSON 파일 생성 등을 절대 시도하지 마라.
버튼을 눌렀을 때 데이터를 저장하거나 불러오는 로직(Backend Logic)을 짜지 마라.
모든 데이터 출력 공간은 오직 "[카테고리] 데이터 영역"이라는 텍스트 Placeholder로만 채워라.
Tailwind Utility-First Styling:
.css 파일을 새로 만들거나 기존 CSS 파일(App.css, index.css)에 직접 스타일을 작성하지 마라.
컴포넌트의 모든 여백, 색상, 레이아웃, 트랜지션은 오직 Tailwind CSS 유틸리티 클래스로만 구현하라.
No Lazy Coding (기존 코드 훼손 방지):
파일을 수정할 때 절대 // ... 기존 코드 생략 ... 같은 축약형(Placeholder)을 사용하지 마라. 항상 수정이 완료된 파일의 '전체 코드(Full Code)'를 반환하거나, 기존 코드가 훼손되지 않도록 정확히 패치(Patch)하라.
Dependency Check (패키지 사전 확인):
새로운 외부 라이브러리(react-router-dom, lucide-react 등)를 코드에 적용하기 전에, 반드시 터미널 도구를 사용해 해당 패키지가 package.json에 설치되어 있는지 확인하고, 없다면 npm install을 먼저 실행하라.
Korean Documentation (한국어 강제):
코드 내부의 모든 주석(Comments), Placeholder 텍스트, 콘솔 로그 메시지, 그리고 Git 커밋 메시지는 반드시 명확하고 자연스러운 '한국어'로 작성하라.
Responsive Layout First (모바일 우선 반응형):
모든 컴포넌트 작성 시 모바일 환경을 우선적으로 고려하여 기본 클래스를 적용하라. 데스크톱 화면 확장은 md: 또는 lg: 접두사를 사용하여 모바일 뷰가 깨지지 않도록 확실하게 반응형을 처리하라.
Component Modularity (컴포넌트 비대화 방지):
단일 파일이 너무 커지지 않도록 주의하라. 코드가 100줄을 넘어가거나 독립적인 UI 조각(예: 버튼, 아이콘 래퍼)이 반복될 경우, 반드시 src/components/ 하위에 새로운 파일로 분리하여 모듈화하라.
**Semantic HTML (무지성 남발 금지):**
화면 구조를 짤 때 무분별한 <div> 사용을 지양하고, 목적에 맞는 시맨틱 HTML5 태그(<header>, <nav>, <main>, <aside>, <footer>, <section>)를 적극적으로 사용하여 구조의 가독성을 높여라.
Naming Convention (네이밍 컨벤션 엄수):
React 컴포넌트 파일명과 함수명은 반드시 첫 글자가 대문자인 PascalCase (예: WidgetBox.jsx)를 사용하고, 일반 유틸리티 함수나 변수명은 camelCase (예: format.js)를 사용하여 일관성을 유지하라.
No Debugging Leftovers (쓰레기 코드 청소):
작업이 완료된 후 최종 코드를 반환하기 전에, 불필요한 console.log, 사용하지 않는 import 구문, 의미 없는 테스트용 주석들을 모두 깔끔하게 제거하라.
No Inline Styles (인라인 스타일 완전 차단):
React 컴포넌트 내부에 style={{ ... }} 형태의 인라인 스타일을 절대 사용하지 마라. 단 1px의 여백 조정이라도 반드시 Tailwind 유틸리티 클래스만으로 해결하라.
Consistent Exports (컴포넌트 Export 방식 통일):
모든 React 컴포넌트는 파일 최상단에서 export default function ComponentName() 형태로 선언하여 내보내기(Export) 방식을 한 가지로 완벽하게 통일하라.
Minimize State Management (단순 상태 관리 제한):
현재는 UI 뼈대 단계이므로 외부 상태 관리 라이브러리(Zustand, Redux 등)나 Context API를 도입하지 마라. 모달 창 열기/닫기, 탭 전환 같은 단순 UI 동작은 해당 컴포넌트 내부의 useState만을 사용하여 가장 가볍게 구현하라.
Basic Accessibility (아이콘 버튼 접근성 강제):
텍스트 없이 아이콘만 존재하는 버튼(예: 플로팅 추가 버튼, 닫기 버튼)에는 반드시 aria-label 속성을 명시적으로 추가하여 웹 접근성(a11y) 기본 요건을 충족하라.
5. Phase 2: Frontend Detailing (기능 및 UI 고도화)
뼈대 구성을 완료한 후, 프론트엔드의 완성도를 상용 서비스 수준으로 끌어올리기 위해 아래 4가지 기능을 추가 구현한다. 기존 노션 스타일의 뼈대 UI(BlockNote 에디터 포함)는 절대 훼손하지 않고 유지해야 한다.
CMD+K (빠른 검색 및 내비게이션)
cmdk 패키지를 설치 및 적용.
단축키 Ctrl + K (또는 Cmd + K) 입력 시 중앙 팝업 형태로 명령어 팔레트를 띄워, 대시보드의 각 페이지(Home, Schedule, Work, Hobbies, Investments)로 즉시 이동할 수 있게 구현한다.
칸반 보드 (Work 페이지)
@hello-pangea/dnd 패키지를 설치.
Work 페이지 내 노션 에디터 영역의 아래쪽에 '할 일', '진행 중', '완료' 3개의 열(Column)로 구성된 칸반 보드를 구현한다. 각 열 간 카드 드래그 앤 드롭 이동이 부드럽게 가능해야 한다.
달력 UI (Schedule 페이지)
Schedule 페이지 내 노션 에디터 영역 아래쪽에 Tailwind Grid(grid-cols-7)를 활용하여 월간 캘린더 뼈대를 구현한다.
요일 헤더와 날짜 칸이 다크모드 카드 형태로 깔끔하게 렌더링 되어야 한다.
토스트 알림 (전역)
sonner 패키지를 설치.
Layout.jsx 최상단에 토스터(<Toaster theme="dark"/>)를 세팅하고, 플로팅 버튼(FAB)을 통해 열린 '새 항목 추가' 모달 창을 닫을 때(또는 저장 액션 시) 화면에 "항목이 추가되었습니다" 등의 토스트 알림이 나타나도록 구현한다.
투자/업무 통계 차트 (Recharts)
recharts 패키지를 설치 및 적용.
Home 메인 화면의 'Investments(투자)' 위젯에 내 포트폴리오 비중을 보여주는 도넛 차트(PieChart)를 구현하거나, 'Work' 위젯에 업무 달성률을 시각화하는 차트를 추가한다. 다크모드에 어울리는 색상을 사용한다.
대시보드 위젯 위치 변경 (Drag & Drop)
Home 화면에 배치된 4개의 메인 위젯(Schedule, Work, Hobbies, Investments)에 @hello-pangea/dnd를 적용하여 사용자가 마우스 드래그로 위젯의 배치 순서를 자유롭게 변경할 수 있도록 구현한다.
로딩 스켈레톤 (Skeleton UI)
데이터베이스 연동 전 미리 시각적 뼈대를 구성하기 위해 Layout.jsx 또는 각 페이지 컴포넌트 내부에 적용한다.
데이터를 불러오는 동안 빈 화면 대신 회색 스켈레톤(뼈대)이 은은하게 깜빡이는 애니메이션(Tailwind의 animate-pulse 등 활용)을 보여주도록 구현한다.
노션 에디터 기능 고도화 (표 및 콜아웃 패널 지원)
NotionEditor.jsx 내의 BlockNote 설정을 고도화하여 표(Table) 생성 기능과 강조 패널(Callout/Alert) 블록을 명시적으로 활성화한다.
슬래시(/) 명령어를 호출했을 때 사용자가 '표'와 '패널'을 바로 선택할 수 있도록 커스텀 메뉴로 구성한다.
생성된 표와 패널이 다크모드 환경(bg-gray-900)에 자연스럽게 녹아들도록 테마 색상을 조화롭게 맞춘다.
텍스트 및 제목 스타일링 (BlockNote 플로팅 툴바 활성화)
텍스트를 드래그했을 때 글씨 크기, 색상, 형광펜 등을 변경할 수 있는 플로팅 툴바(Floating Toolbar)를 명시적으로 활성화한다.
H1, H2, H3 제목 블록의 폰트 사이즈가 다크모드 화면에서 시각적 위계를 갖도록 CSS를 조정한다.
위키(Wiki) 코어 기능 UI (데이터 연동 배제)
코드 블록 (Syntax Highlighting): 파이썬, 자바스크립트 등 코드 입력 시 색상이 하이라이팅되는 기능을 활성화한다.
토글 블록 (Toggle): 화살표를 눌러 하위 내용을 접고 펼칠 수 있는 블록을 슬래시(/) 메뉴에 추가한다.
빵부스러기 (Breadcrumbs): 페이지 상단 헤더 영역에 Home > Work > 현재 제목 형태의 네비게이션 경로 UI를 구현한다.
자동 목차 (TOC) 레이아웃: 에디터 우측 여백에 본문의 제목(H1~H3) 리스트가 렌더링될 수 있는 고정(Sticky) 목차 패널 뼈대를 추가한다.
로컬 스토리지 자동 저장 (Auto-save to LocalStorage)
작성한 글이나 표가 날아가지 않도록, 브라우저 캐시(localStorage)에 실시간으로 임시 저장되게 구현한다. (새로고침해도 내용이 유지되도록)
드래그형 사이드바 크기 조절 (Resizable Sidebar)
PC 환경에서 좌측 사이드바와 메인 에디터 화면 사이의 경계선을 마우스로 잡고 끌어서(Drag) 좌우 너비를 자유롭게 조절할 수 있도록 구현한다.
다크/라이트 모드 스위치 (Theme Toggle)
기본은 다크모드로 유지하되, 헤더 우측에 ☀️/🌙 아이콘을 배치하여 클릭 시 전체 화면이 라이트모드/다크모드로 부드럽게 전환되도록 구현한다.
6. Phase 3: Supabase Backend & Logic
목표: 외부 데이터베이스(Supabase)를 연결하여 프론트엔드와 통신하는 CRUD 파이프라인을 구축한다. 절대 원칙: 초기 테이블은 완전히 비어있는(Empty) 상태로 둔다. 더미 데이터나 실제 데이터를 DB에 미리 채워 넣지 않는다.
1. Supabase 세팅 및 연결
사전 준비 (환경 변수 생성)
Supabase 프로젝트의 Settings > API 메뉴에서 Project URL과 anon (public) key를 복사한다.
PC(로컬 작업 환경)의 프로젝트 최상단 폴더에 .env.local 파일을 생성한다.
아래의 양식에 맞추어 API 키를 저장한다.
VITE_SUPABASE_URL=여기에_프로젝트_URL_붙여넣기
VITE_SUPABASE_ANON_KEY=여기에_anon_key_붙여넣기
@supabase/supabase-js 패키지를 설치한다.
src/lib/supabaseClient.js 파일을 생성하고, 환경 변수(.env.local의 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)를 사용하여 클라이언트를 초기화한다.
2. Database Schema (테이블 구조 기획)
Supabase SQL Editor에서 생성할 4개의 핵심 테이블 구조다. (데이터는 넣지 않음)
테이블 1: work (업무/프로젝트)
id (uuid, primary key), title (text), status (text: Todo/In Progress/Done), progress (int: 0~100), content (jsonb: BlockNote 에디터 데이터 저장용), created_at (timestamp)
테이블 2: hobbies (취미/학습)
id (uuid, primary key), title (text), details (text), content (jsonb), created_at (timestamp)
테이블 3: investments (투자)
id (uuid, primary key), ticker (text), name (text), avg_price (numeric), quantity (numeric), created_at (timestamp)
테이블 4: schedule (일정)
id (uuid, primary key), title (text), date (date), created_at (timestamp)
3. 프론트엔드 로직 마이그레이션 (Local -> Supabase)
기존 localStorage에 임시 저장하던 에디터 로직을 제거하고, Supabase의 content (jsonb) 컬럼에 저장/불러오도록 로직을 전면 수정한다.
상태 관리: 데이터를 불러오는 동안 화면에 구현해 둔 '로딩 스켈레톤(Skeleton UI)'이 정상적으로 노출되도록 비동기 처리(isLoading 상태)를 완벽하게 적용하며, 데이터가 없는 빈 화면(Empty State) 상태일 때는 "아직 등록된 항목이 없습니다"라는 문구가 노출되도록 구현한다.
에러 핸들링: 통신 실패 시 토스트 알림(sonner)을 통해 "데이터를 불러오지 못했습니다"라는 메시지가 뜨도록 예외 처리를 추가한다.
