<div align="center">

# 📊 My Dashboard

**모션 캡처 · 3D 파이프라인 작업, 투자, 일정, 취미를 한 곳에서 관리하는**
**노션(Notion) 스타일의 개인용 다크모드 대시보드**

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Auth_%2B_DB-3ECF8E?logo=supabase&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-설치_가능-5A0FC8?logo=pwa&logoColor=white)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)

</div>

---

## ✨ 핵심 기능

### 📝 위키형 에디터
[BlockNote](https://www.blocknotejs.org/) 기반의 노션 같은 블록 에디터입니다.

- 슬래시(`/`) 명령어로 제목(H1~H3), 목록, **표**, **코드 블록**, **토글 블록**을 바로 삽입
- 코드 블록 **문법 하이라이팅** (Python, JavaScript 등)
- 텍스트를 드래그하면 나타나는 **플로팅 툴바** (굵게·기울임, 글씨 크기, 색상, 형광펜)
- 빵부스러기(`Home > Work > 현재 제목`)와 본문 제목을 모아 보여주는 **고정 목차(TOC) 패널**
- 입력을 멈추면 1.5초 뒤 클라우드에 **자동 저장**, 우측 상단에 `저장 중...` → `저장됨` 표시. 다른 기기에서도 같은 내용으로 열림

### 🗂️ 칸반 보드
- Work 페이지에서 **할 일 / 진행 중 / 완료** 3개 열 사이로 카드를 드래그 앤 드롭
- 이동하면 `status`와 진행률(0 / 50 / 100%)이 **DB에 자동 동기화**, 실패하면 원래 자리로 되돌림

### 🔎 빠른 검색
- `Cmd + K` (Windows는 `Ctrl + K`)로 **커맨드 팔레트**를 열어 모든 페이지로 즉시 이동

### 📱 반응형 UI & 앱 설치
- **PC**: 너비를 드래그로 조절할 수 있는 좌측 사이드바
- **모바일**: 앱처럼 하단에 고정되는 탭 메뉴 + 플로팅 추가(+) 버튼
- 다크 / 라이트 모드 전환 (기본은 다크)
- **PWA**: 스마트폰 홈 화면에 설치하면 주소창 없이 전체 화면 앱처럼 실행

### 🧩 그 밖의 기능
| 영역 | 내용 |
| --- | --- |
| Home | 위젯(Schedule · Work · Hobbies · Investments)을 **제목을 잡고 드래그**해 순서 변경, 보유 종목 비중 **도넛 차트** |
| Schedule | 이번 달 **월간 달력**에 일정 표시 |
| Investments | 도넛 차트와 함께 종목별 **티커 · 평단가 · 수량** 표 |
| 공통 | 로딩 **스켈레톤**, "아직 등록된 항목이 없습니다" 빈 화면, 성공/실패 **토스트 알림** |

---

## 🔐 인증 및 백엔드 (Authentication & DB)

[Supabase](https://supabase.com/)로 로그인과 데이터베이스를 모두 처리합니다.

- **이메일/비밀번호 로그인 및 회원가입** (`signInWithPassword`, `signUp`)
- **보호된 라우트**: 로그인하지 않으면 어떤 페이지로 들어가도 로그인 화면으로 이동
- **Row Level Security(RLS)**: 모든 테이블에 `user_id`가 있고, 정책 `auth.uid() = user_id`로 **내 데이터만 읽고 쓸 수 있음**
- **실시간 DB 동기화**: 항목 **추가 · 수정 · 삭제**가 즉시 Supabase에 반영
- **Optimistic UI + 롤백**: 화면을 먼저 바꾸고 통신하며, 실패하면 **원래 상태로 되돌리고 에러 토스트** 표시
- **삭제 확인창**: 실수로 지우지 않도록 삭제 전 확인
- **설정 페이지**: 로그인 이메일 확인, **비밀번호 변경**, **계정 삭제**(내 모든 데이터 함께 삭제)

### 데이터베이스 구조

| 테이블 | 용도 | 주요 컬럼 |
| --- | --- | --- |
| `work` | 업무 / 프로젝트 | `title`, `status` (Todo · In Progress · Done), `progress`, `content` |
| `hobbies` | 취미 / 학습 | `title`, `details`, `content` |
| `investments` | 투자 | `ticker`, `name`, `avg_price`, `quantity` |
| `schedule` | 일정 | `title`, `date` |
| `pages` | 페이지 본문·제목 자동 저장 | `path`, `title`, `content` |

모든 테이블에 `id`, `user_id`, `created_at`이 있습니다. 초기 상태는 **완전히 빈 테이블**입니다.

---

## 🛠️ 기술 스택

| 구분 | 사용 기술 |
| --- | --- |
| 프레임워크 | React 19, Vite 7, React Router 7 |
| 스타일 | Tailwind CSS 4 |
| 에디터 | BlockNote 0.56 |
| 인터랙션 | @hello-pangea/dnd (드래그 앤 드롭), cmdk (커맨드 팔레트), sonner (토스트) |
| 차트 | Recharts |
| 백엔드 | Supabase (Auth, PostgreSQL, RLS) |
| 앱 설치 | vite-plugin-pwa |
| 배포 | Vercel |

---

## 🚀 시작하기

### 1. 설치

```bash
git clone https://github.com/leejongsoo91-create/LEE0011.git
cd LEE0011
npm install
```

### 2. 환경 변수

`.env.example`을 `.env.local`로 복사하고 Supabase 프로젝트의 **Settings → API** 값으로 채웁니다.

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

> `.env.local`은 git에 올라가지 않습니다. 배포할 때는 Vercel의 **Environment Variables**에 같은 두 값을 넣어 주세요.

### 3. 데이터베이스 준비

Supabase **SQL Editor**에서 `supabase/migrations/` 폴더의 파일을 **순서대로** 실행합니다.

| 순서 | 파일 | 내용 |
| --- | --- | --- |
| 1 | `20261021000000_create_core_tables.sql` | 핵심 테이블 4개 생성 |
| 2 | `20261021010000_add_user_id_and_auth_policies.sql` | `user_id` 추가, RLS(내 데이터만 접근) 적용 |
| 3 | `20261022000000_create_pages_and_delete_account.sql` | `pages` 테이블, 계정 삭제 함수 `delete_my_account()` |

### 4. 로그인 설정

Supabase **Authentication**에서 Email 로그인이 켜져 있는지 확인합니다.

- 혼자 쓰는 경우: **Users → Add user**로 내 계정을 만들고(Auto Confirm User 체크), **Allow new users to sign up**을 꺼서 외부 가입을 막는 것을 권장합니다.
- 바로 가입·로그인하려면 **Confirm email** 옵션을 끄세요.

### 5. 실행

```bash
npm run dev       # 개발 서버
npm run build     # 배포용 빌드
npm run preview   # 빌드 결과 미리보기
```

### 🔔 텔레그램 일정 알림 (선택)

Schedule에서 새 일정을 등록하면 텔레그램으로 알림이 옵니다.

```text
📅 [새로운 일정 등록]
날짜: 2026년 10월 23일
내용: 일정 제목
```

- 알림은 Vercel **서버 함수**(`api/notify-schedule.js`)가 보냅니다. 봇 토큰이 브라우저 코드에 들어가지 않도록 `VITE_` 접두사 없이 **Vercel 환경변수**에만 등록합니다.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`를 등록한 뒤 다시 배포하세요. 로그인한 사용자만 호출할 수 있습니다.
- 전송에 실패해도 일정 저장과 화면 동작에는 영향이 없습니다. 로컬 `npm run dev`에서는 서버 함수가 없어 알림이 가지 않습니다.

### 📲 스마트폰에 앱으로 설치

| 기기 | 방법 |
| --- | --- |
| Android (Chrome) | 메뉴(⋮) → **앱 설치** 또는 **홈 화면에 추가** |
| iPhone (Safari) | 공유 버튼 → **홈 화면에 추가** |

---

## 📁 프로젝트 구조

```text
├── public/                  # PWA 아이콘
├── supabase/migrations/     # 데이터베이스 SQL (순서대로 실행)
├── docs/SPEC.md             # 초기 기획서(UI 뼈대 단계)
└── src/
    ├── components/          # Layout, Sidebar, BottomTab, KanbanBoard, NotionEditor 등
    ├── pages/               # Home, Schedule, Work, Hobbies, Investments, Settings, Login
    ├── hooks/               # useRows, usePageDoc(자동 저장), useRowDelete, useSession 등
    ├── lib/                 # supabaseClient, db(CRUD), auth
    └── utils/               # 테마, 제목, 목차 등 도우미
```

---

## 🗺️ 앞으로 할 일

- [ ] 에디터의 콜아웃(강조 패널) 블록
- [ ] Investments 종목의 수정 화면
