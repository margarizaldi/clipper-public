/**
 * Smart Clipper — Static Release & Changelog Portal
 */

const GITHUB_REPO = 'margarizaldi/clipper-public';
const API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases`;
const CACHE_KEY = `clipper_releases_${GITHUB_REPO}`;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

// OS Detection
function detectUserOS() {
  const ua = navigator.userAgent.toLowerCase();
  const platform = (
    navigator.userAgentData?.platform ||
    navigator.platform ||
    ''
  ).toLowerCase();

  if (
    platform.includes('mac') ||
    ua.includes('macintosh') ||
    ua.includes('mac os x')
  ) {
    // Check for Apple Silicon if possible via userAgentData or WebGL
    return {
      os: 'macos',
      name: 'macOS',
      arch:
        ua.includes('arm') || navigator.userAgentData?.architecture === 'arm'
          ? 'arm64'
          : 'universal',
    };
  }
  if (platform.includes('win') || ua.includes('windows')) {
    return { os: 'windows', name: 'Windows', arch: 'x64' };
  }
  if (
    platform.includes('linux') ||
    ua.includes('linux') ||
    ua.includes('x11')
  ) {
    return { os: 'linux', name: 'Linux', arch: 'x64' };
  }
  return { os: 'unknown', name: 'Unknown', arch: 'unknown' };
}

// Format bytes to human readable size
function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Format ISO date
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Markdown to HTML parser using marked library
function parseMarkdown(md) {
  if (!md) return '<p><em>Tidak ada konten.</em></p>';

  if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
    return marked.parse(md, {
      gfm: true,
      breaks: true,
    });
  }

  // Fallback if marked is not loaded
  return `<p>${md.replace(/\n/g, '<br>')}</p>`;
}

// Categorize release assets
function categorizeAssets(assets = []) {
  const categorized = {
    macArm: null,
    macIntel: null,
    macUniversal: null,
    windowsExe: null,
    windowsMsi: null,
    linuxAppImage: null,
    linuxDeb: null,
    others: [],
  };

  assets.forEach((asset) => {
    const name = asset.name.toLowerCase();

    // Ignore signatures and updater manifests in the main table
    if (name.endsWith('.sig') || name === 'latest.json') {
      return;
    }

    if (
      name.endsWith('.dmg') ||
      name.includes('darwin') ||
      name.includes('macos') ||
      (name.endsWith('.tar.gz') && name.includes('app'))
    ) {
      if (name.includes('aarch64') || name.includes('arm64')) {
        categorized.macArm = asset;
      } else if (
        name.includes('x64') ||
        name.includes('x86_64') ||
        name.includes('intel')
      ) {
        categorized.macIntel = asset;
      } else {
        categorized.macUniversal = asset;
      }
    } else if (name.endsWith('.exe') || name.endsWith('.msi')) {
      if (name.endsWith('.exe')) categorized.windowsExe = asset;
      else if (name.endsWith('.msi')) categorized.windowsMsi = asset;
    } else if (
      name.endsWith('.appimage') ||
      name.endsWith('.deb') ||
      name.includes('linux')
    ) {
      if (name.endsWith('.appimage')) categorized.linuxAppImage = asset;
      else if (name.endsWith('.deb')) categorized.linuxDeb = asset;
      else categorized.others.push(asset);
    } else {
      categorized.others.push(asset);
    }
  });

  return categorized;
}

// Build Platform Downloads Table Rows
function generateDownloadTableHTML(assets, userOS) {
  const cat = categorizeAssets(assets);
  const rows = [];

  // 1. macOS Apple Silicon
  if (cat.macArm) {
    const isRecommended = userOS.os === 'macos';
    rows.push(`
      <tr class="${isRecommended ? 'recommended-row' : ''}">
        <td><div class="os-cell"><strong>macOS</strong> (Apple Silicon / M1/M2/M3/M4)</div></td>
        <td><code>.dmg</code> installer</td>
        <td class="file-size">${formatBytes(cat.macArm.size)}</td>
        <td><a href="${cat.macArm.browser_download_url}" class="btn ${isRecommended ? 'btn-primary' : ''}">Unduh</a></td>
      </tr>
    `);
  }

  // 2. macOS Intel
  if (cat.macIntel) {
    const isRecommended = userOS.os === 'macos' && !cat.macArm;
    rows.push(`
      <tr class="${isRecommended ? 'recommended-row' : ''}">
        <td><div class="os-cell"><strong>macOS</strong> (Intel x64)</div></td>
        <td><code>.dmg</code> installer</td>
        <td class="file-size">${formatBytes(cat.macIntel.size)}</td>
        <td><a href="${cat.macIntel.browser_download_url}" class="btn ${isRecommended ? 'btn-primary' : ''}">Unduh</a></td>
      </tr>
    `);
  }

  // 2b. macOS Universal / Other
  if (cat.macUniversal && !cat.macArm && !cat.macIntel) {
    const isRecommended = userOS.os === 'macos';
    rows.push(`
      <tr class="${isRecommended ? 'recommended-row' : ''}">
        <td><div class="os-cell"><strong>macOS</strong></div></td>
        <td><code>${cat.macUniversal.name.split('.').pop()}</code></td>
        <td class="file-size">${formatBytes(cat.macUniversal.size)}</td>
        <td><a href="${cat.macUniversal.browser_download_url}" class="btn ${isRecommended ? 'btn-primary' : ''}">Unduh</a></td>
      </tr>
    `);
  }

  // 3. Windows Installer (.exe)
  if (cat.windowsExe) {
    const isRecommended = userOS.os === 'windows';
    rows.push(`
      <tr class="${isRecommended ? 'recommended-row' : ''}">
        <td><div class="os-cell"><strong>Windows</strong> (64-bit)</div></td>
        <td><code>.exe</code> installer</td>
        <td class="file-size">${formatBytes(cat.windowsExe.size)}</td>
        <td><a href="${cat.windowsExe.browser_download_url}" class="btn ${isRecommended ? 'btn-primary' : ''}">Unduh</a></td>
      </tr>
    `);
  }

  // 4. Windows MSI
  if (cat.windowsMsi) {
    rows.push(`
      <tr>
        <td><div class="os-cell"><strong>Windows</strong> (64-bit MSI)</div></td>
        <td><code>.msi</code> package</td>
        <td class="file-size">${formatBytes(cat.windowsMsi.size)}</td>
        <td><a href="${cat.windowsMsi.browser_download_url}" class="btn">Unduh</a></td>
      </tr>
    `);
  }

  // 5. Linux AppImage
  if (cat.linuxAppImage) {
    const isRecommended = userOS.os === 'linux';
    rows.push(`
      <tr class="${isRecommended ? 'recommended-row' : ''}">
        <td><div class="os-cell"><strong>Linux</strong> (x64)</div></td>
        <td><code>.AppImage</code> standalone</td>
        <td class="file-size">${formatBytes(cat.linuxAppImage.size)}</td>
        <td><a href="${cat.linuxAppImage.browser_download_url}" class="btn ${isRecommended ? 'btn-primary' : ''}">Unduh</a></td>
      </tr>
    `);
  }

  // 6. Linux DEB
  if (cat.linuxDeb) {
    rows.push(`
      <tr>
        <td><div class="os-cell"><strong>Linux</strong> (Debian / Ubuntu)</div></td>
        <td><code>.deb</code> package</td>
        <td class="file-size">${formatBytes(cat.linuxDeb.size)}</td>
        <td><a href="${cat.linuxDeb.browser_download_url}" class="btn">Unduh</a></td>
      </tr>
    `);
  }

  // Fallback for any other listed asset
  if (rows.length === 0 && assets.length > 0) {
    assets.forEach((asset) => {
      rows.push(`
        <tr>
          <td><div class="os-cell">${asset.name}</div></td>
          <td>Paket Biner</td>
          <td class="file-size">${formatBytes(asset.size)}</td>
          <td><a href="${asset.browser_download_url}" class="btn">Unduh</a></td>
        </tr>
      `);
    });
  }

  if (rows.length === 0) {
    return `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 16px;">Belum ada paket rilis untuk versi ini.</td></tr>`;
  }

  return rows.join('');
}

// Find primary recommendation asset for the user
function getRecommendedAsset(assets, userOS) {
  const cat = categorizeAssets(assets);
  if (userOS.os === 'macos') {
    return cat.macArm || cat.macUniversal || cat.macIntel;
  }
  if (userOS.os === 'windows') {
    return cat.windowsExe || cat.windowsMsi;
  }
  if (userOS.os === 'linux') {
    return cat.linuxAppImage || cat.linuxDeb;
  }
  return cat.macArm || cat.windowsExe || cat.linuxAppImage;
}

// Render Latest Release Section
function renderLatestRelease(release, userOS) {
  const container = document.getElementById('latest-release-container');
  if (!container) return;

  const version = release.tag_name || release.name || 'Terbaru';
  const releaseDate = formatDate(release.published_at || release.created_at);
  const recommendedAsset = getRecommendedAsset(release.assets || [], userOS);

  let recommendedBannerHTML = '';
  if (recommendedAsset) {
    recommendedBannerHTML = `
      <div class="recommended-banner">
        <div class="recommended-info">
          <span>Sistem Operasi: <strong>${userOS.name}</strong></span> &bull;
          <span style="color:var(--text-muted);">${recommendedAsset.name} (${formatBytes(recommendedAsset.size)})</span>
        </div>
        <a href="${recommendedAsset.browser_download_url}" class="btn btn-primary">
          Unduh untuk ${userOS.name}
        </a>
      </div>
    `;
  }

  const tableRows = generateDownloadTableHTML(release.assets || [], userOS);
  const changelogHTML = parseMarkdown(release.body);

  container.innerHTML = `
    <div class="card highlight">
      <div class="release-header">
        <div>
          <span class="version-tag">${version}</span>
          <span class="badge latest">Terbaru</span>
        </div>
        <span class="release-date">Dirilis pada ${releaseDate}</span>
      </div>

      ${recommendedBannerHTML}

      <div class="table-wrapper">
        <table class="download-table">
          <thead>
            <tr>
              <th>Platform</th>
              <th>Format</th>
              <th>Ukuran</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>

      <div class="changelog-box">
        <div class="changelog-title">Catatan Perubahan</div>
        <div class="changelog-body">${changelogHTML}</div>
      </div>
    </div>
  `;
}

// Render Previous Releases Section
function renderPreviousReleases(releases, userOS) {
  const container = document.getElementById('previous-releases-container');
  if (!container) return;

  if (!releases || releases.length === 0) {
    container.innerHTML = `<p class="status-state">Tidak ada riwayat versi sebelumnya.</p>`;
    return;
  }

  const html = releases
    .map((release, idx) => {
      const version = release.tag_name || release.name || `Versi ${idx + 2}`;
      const releaseDate = formatDate(
        release.published_at || release.created_at,
      );
      const tableRows = generateDownloadTableHTML(release.assets || [], userOS);
      const changelogHTML = parseMarkdown(release.body);

      return `
      <details class="older-release">
        <summary>
          <span>${version}</span>
          <span class="release-date">${releaseDate}</span>
        </summary>
        <div class="details-content">
          <div class="table-wrapper">
            <table class="download-table">
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Format</th>
                  <th>Ukuran</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>
          <div class="changelog-box">
            <div class="changelog-title">Catatan Perubahan</div>
            <div class="changelog-body">${changelogHTML}</div>
          </div>
        </div>
      </details>
    `;
    })
    .join('');

  container.innerHTML = html;
}

// Fetch releases from GitHub API with caching
async function loadReleases() {
  const userOS = detectUserOS();
  const latestContainer = document.getElementById('latest-release-container');
  const previousContainer = document.getElementById(
    'previous-releases-container',
  );

  try {
    // Check SessionStorage Cache
    const cached = sessionStorage.getItem(CACHE_KEY);
    const cachedTime = sessionStorage.getItem(`${CACHE_KEY}_time`);

    let releases = null;
    if (
      cached &&
      cachedTime &&
      Date.now() - parseInt(cachedTime, 10) < CACHE_TTL_MS
    ) {
      releases = JSON.parse(cached);
    } else {
      const response = await fetch(API_URL, {
        headers: { Accept: 'application/vnd.github.v3+json' },
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: HTTP ${response.status}`);
      }

      releases = await response.json();
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(releases));
      sessionStorage.setItem(`${CACHE_KEY}_time`, Date.now().toString());
    }

    if (!Array.isArray(releases) || releases.length === 0) {
      latestContainer.innerHTML = `
        <div class="card">
          <div class="status-state">
            <p><strong>Belum ada versi publik yang dirilis.</strong></p>
            <p style="margin-top:6px; font-size:13px;">Versi baru yang dirilis akan muncul di sini secara otomatis.</p>
          </div>
        </div>
      `;
      previousContainer.innerHTML = `<p class="status-state">Tidak ada riwayat versi sebelumnya.</p>`;
      return;
    }

    const latest = releases[0];
    const previous = releases.slice(1);

    renderLatestRelease(latest, userOS);
    renderPreviousReleases(previous, userOS);
  } catch (err) {
    console.warn('Failed to fetch live releases from GitHub API:', err);
    latestContainer.innerHTML = `
      <div class="card">
        <div class="status-state">
          <p><strong>Gagal memuat data versi dari GitHub.</strong></p>
          <p style="margin-top:6px; font-size:13px; color:var(--text-muted);">
            Lihat semua versi langsung di <a href="https://github.com/${GITHUB_REPO}/releases" target="_blank" rel="noopener">GitHub Releases</a>.
          </p>
        </div>
      </div>
    `;
    previousContainer.innerHTML = `<p class="status-state">Silakan cek GitHub untuk versi sebelumnya.</p>`;
  }
}

// Fetch and render license from license.md
async function loadLicense() {
  const container = document.getElementById('license-container');
  if (!container) return;

  try {
    let md = '';
    try {
      const res = await fetch('./license.md');
      if (res.ok) md = await res.text();
    } catch {
      // Fallback for local file:// testing
      const res = await fetch(
        `https://raw.githubusercontent.com/${GITHUB_REPO}/main/license.md`,
      );
      if (res.ok) md = await res.text();
    }

    if (md) {
      container.innerHTML = parseMarkdown(md);
    } else {
      throw new Error('Could not fetch license content');
    }
  } catch (err) {
    console.warn('Failed to load license.md:', err);
    container.innerHTML = `
      <p class="status-state">
        Ketentuan lisensi dapat dilihat di <a href="https://github.com/${GITHUB_REPO}/blob/main/license.md" target="_blank" rel="noopener">license.md</a>.
      </p>
    `;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadReleases();
  loadLicense();
});
