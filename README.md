# Hướng dẫn build

## Cài dependency

```bash
npm ci --ignore-scripts --no-audit --no-fund
```

## Chạy unit test

```bash
npm test
```

CI tự cấu hình theo hệ của đội tiếp nhận; chuỗi chuẩn là install → `npm test` → `npm run build`.

## Build

```bash
npm run build
```

## Build target

```text
dist/
```
