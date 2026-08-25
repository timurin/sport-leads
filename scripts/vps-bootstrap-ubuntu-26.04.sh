#!/usr/bin/env bash
# Host bootstrap for Sport-Lead VPS (roadmap 0.5.4.1 / ADR-032).
# Ubuntu 26.04: Docker Engine + Compose plugin, git, UFW, curl; TZ Europe/Moscow.
# Does not install host Python/Node — the app runs in compose.prod.yaml images.
# Usage (on the VPS): sudo bash scripts/vps-bootstrap-ubuntu-26.04.sh
# Before clone: scp this file from the Windows repo, or copy-paste the runbook.

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

if [[ ! -r /etc/os-release ]]; then
  echo "/etc/os-release not found" >&2
  exit 1
fi

# shellcheck source=/dev/null
. /etc/os-release

echo "Detected: ${NAME:-unknown} ${VERSION_ID:-?} (${UBUNTU_CODENAME:-${VERSION_CODENAME:-?}})"

if [[ "${ID:-}" != "ubuntu" ]]; then
  echo "This script is for Ubuntu only (got ID=${ID:-empty})." >&2
  exit 1
fi

if [[ "${VERSION_ID:-}" != "26.04" ]]; then
  if [[ "${SPORT_LEADS_ALLOW_OTHER_UBUNTU:-}" == "1" ]]; then
    echo "WARNING: VERSION_ID=${VERSION_ID} is not 26.04; continuing because SPORT_LEADS_ALLOW_OTHER_UBUNTU=1"
  else
    echo "Expected Ubuntu 26.04 (got ${VERSION_ID:-unknown}). Refusing." >&2
    echo "If this host is intentionally another Ubuntu LTS, re-run with SPORT_LEADS_ALLOW_OTHER_UBUNTU=1" >&2
    exit 1
  fi
fi

if command -v snap >/dev/null 2>&1 && snap list docker >/dev/null 2>&1; then
  echo "snap docker is installed. Remove it first (do not mix snap Docker with Docker CE):" >&2
  echo "  sudo snap remove docker" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y ca-certificates curl git ufw

# Official Docker uninstall of distro packages (ignore if absent).
for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do
  apt-get remove -y "$pkg" >/dev/null 2>&1 || true
done

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

CODENAME="${UBUNTU_CODENAME:-${VERSION_CODENAME}}"
ARCH="$(dpkg --print-architecture)"

# Prefer current Docker deb822; drop the one-line list from earlier runbook drafts.
rm -f /etc/apt/sources.list.d/docker.list

cat >/etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${CODENAME}
Components: stable
Architectures: ${ARCH}
Signed-By: /etc/apt/keyrings/docker.asc
EOF

if ! apt-get update; then
  echo "apt-get update failed after adding Docker's repo (codename=${CODENAME})." >&2
  echo "Follow https://docs.docker.com/engine/install/ubuntu/ — do not snap install docker." >&2
  exit 1
fi

if ! apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin; then
  echo "Docker CE packages were not installed. See https://docs.docker.com/engine/install/ubuntu/" >&2
  echo "Do not apt install python3-pip or Node for Sport-Lead on this host." >&2
  exit 1
fi

systemctl enable --now docker

timedatectl set-timezone Europe/Moscow

ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
# Postgres stays on loopback via compose.prod.yaml — never open 5432 on WAN.
ufw --force enable

DOCKER_USER="${SUDO_USER:-}"
if [[ -n "${DOCKER_USER}" && "${DOCKER_USER}" != "root" ]]; then
  usermod -aG docker "${DOCKER_USER}"
  echo "Added ${DOCKER_USER} to group docker (log out and back in before docker without sudo)."
else
  echo "Run usermod -aG docker YOUR_USER after this script, then re-login."
fi

echo
echo "=== 0.5.4.1 host check ==="
echo "OS:        ${NAME} ${VERSION_ID} (${CODENAME})"
echo "Timezone:  $(timedatectl show -p Timezone --value)"
docker --version
docker compose version
echo "UFW:"
ufw status verbose | sed -n '1,20p'
echo
echo "Do not apt install Python/Node for the ERP. Next: 0.5.3 push to main, then 0.5.4 clone + .env.production."
echo "Done."
