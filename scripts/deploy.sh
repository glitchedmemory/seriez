#!/usr/bin/env bash
# Seriez 배포 스크립트
# 사용법: bash scripts/deploy.sh
#
# 핵심: VPS 메모리(3.7GB) 부족으로 빌드 중 OOM 발생을 막기 위해,
# 빌드 전에 실행 중인 next-server를 잠시 정지(pm2 stop)한다.
# 빌드가 실패하더라도 서버는 반드시 복구(pm2 restart)해서 다운타임을 막는다.

set -u  # 미정의 변수 사용 시 종료 (set -e는 빌드 실패 분기 때문에 비활성)

SSH_HOST="seriez-direct"
REMOTE_DIR="/root/seriez"
LOG_FILE="/tmp/seriez-deploy.log"

echo "▶ Seriez 배포 시작 ($(date '+%Y-%m-%d %H:%M:%S %Z')) | 로그: ${REMOTE_DIR}${LOG_FILE}"

# 0) 사전 검사 — 갈래 분리·데이터 유실 방지
#
# 예전에는 무조건 `git reset --hard origin/main` 을 실행했다. 그래서 VPS 에서
# 직접 고친 코드가 커밋되어 있든 안 되어 있든 전부 사라졌고, 그 결과 VPS 갈래와
# origin/main 이 몇 달에 걸쳐 1,200커밋씩 갈라졌다(2026-11 병합에서 확인).
# 아래 두 검사를 통과하지 못하면 배포하지 않는다.
echo "▶ 사전 검사 중..."
CHECK=$(ssh "${SSH_HOST}" "cd ${REMOTE_DIR} && \
  DIRTY=\$(git status --porcelain | grep -v '^??' | wc -l) && \
  UNPUSHED=\$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0) && \
  echo \"\${DIRTY}:\${UNPUSHED}\"")

DIRTY_COUNT="${CHECK%%:*}"
UNPUSHED_COUNT="${CHECK##*:}"

if [ "${DIRTY_COUNT}" -gt 0 ]; then
  echo ""
  echo "⛔ 배포 중단: 커밋되지 않은 변경이 ${DIRTY_COUNT}개 있습니다."
  echo "   이대로 배포하면 reset --hard 로 사라집니다."
  ssh "${SSH_HOST}" "cd ${REMOTE_DIR} && git status --short | grep -v '^??'"
  echo ""
  echo "   해결: ssh ${SSH_HOST} 'cd ${REMOTE_DIR} && git add -A && git commit -m \"...\" && git push origin main'"
  exit 1
fi

if [ "${UNPUSHED_COUNT}" -gt 0 ]; then
  echo ""
  echo "⛔ 배포 중단: push 되지 않은 커밋이 ${UNPUSHED_COUNT}개 있습니다."
  echo "   이대로 배포하면 VPS 갈래와 origin 이 다시 갈라집니다."
  ssh "${SSH_HOST}" "cd ${REMOTE_DIR} && git log --oneline origin/main..HEAD | head -10"
  echo ""
  echo "   해결: ssh ${SSH_HOST} 'cd ${REMOTE_DIR} && git push origin main'"
  exit 1
fi

echo "▶ 사전 검사 통과 (미커밋 0, 미push 0)"

# 1) 빌드 전 실행 중인 서버 정지 → 메모리 확보 (OOM 방지)
echo "▶ 빌드 전 서버 정지 (메모리 확보)..."
ssh "${SSH_HOST}" "cd ${REMOTE_DIR} && pm2 stop seriez"

# 2) 원격 배포: pull → .next 정리 → 빌드 → restart (실패해도 복구)
#    || 블록에서 항상 pm2 restart를 실행해 서버 다운 방지
ssh "${SSH_HOST}" \
  "cd ${REMOTE_DIR} && \
   git fetch origin && git reset --hard origin/main && \
   rm -rf .next && \
   echo '▶ 빌드 시작...' && \
   ( npm run build >> ${LOG_FILE} 2>&1 && echo '===BUILD OK===' >> ${LOG_FILE} \
     || { echo '===BUILD FAILED===' >> ${LOG_FILE}; } ) && \
   pm2 restart seriez && \
   echo '===DEPLOY DONE===' >> ${LOG_FILE}"

echo "▶ 배포 명령 실행 완료."
echo "▶ 빌드 로그 꼬리:"
ssh "${SSH_HOST}" "tail -12 ${LOG_FILE}"

# 3) 최종 서버 상태 확인
echo "▶ PM2 서버 상태:"
ssh "${SSH_HOST}" "pm2 jlist 2>/dev/null | node -e \"let d=JSON.parse(require('fs').readFileSync(0));d.forEach(p=>console.log(p.name + ' ' + p.pm2_env.status))\""

echo "▶ 홈페이지 응답 확인:"
ssh "${SSH_HOST}" "curl -s -o /dev/null -w 'HTTP %{http_code}\n' http://localhost:3000/"
