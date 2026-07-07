# StockMate Order System

StockMate 기반 발주/재고 관리 시스템 작업용 복사본입니다.

## 구성

- `server.js`: Express API 서버와 정적 파일 서빙
- `public/index.html`: 화면 구조
- `public/app.js`: 로그인, 발주, 재고, 승인, 통계 화면 로직
- `public/style.css`: UI 스타일
- `data/db.json`: 샘플 사용자, 매장, 상품, 재고, 발주 데이터
- `package.json`, `package-lock.json`: Node.js 의존성 정보
- `StockMate_이현우.pptx`, `StockMate_이현우.mp4`: 기존 발표/시연 자료

## 실행

의존성 설치 후 서버를 실행합니다.

```bash
npm install
npm start
```

기본 주소는 `http://localhost:3000` 입니다.

## 샘플 계정

| 역할 | 계정 | 비밀번호 |
| --- | --- | --- |
| 매장 | 성수 매장 | 1234 |
| 관리자 | 본사 관리자 | 1234 |

## 주요 기능

- 매장/관리자 역할별 로그인
- 매장 발주 신청
- 관리자 발주 승인/반려
- 발주 승인 시 재고 자동 증가
- 매장별 재고 및 안전 재고 관리
- 관리자 통계 화면
- 발주 CSV 다운로드

## 원본 위치

이 작업 폴더는 아래 원본 프로젝트에서 `node_modules`와 `.git`을 제외하고 복사했습니다.

```text
/Users/ihyeon-u/web_programming/web_code/stockmate_order_system
```
