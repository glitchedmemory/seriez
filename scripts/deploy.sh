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
