let videos = [];
let currentPlayer = null;
let currentPage = 1;
const videosPerPage = 5;
const videoDataCache = new Map();
const maxVideoId = 50;
let walineInstance = null;
let walineListInstance = null;

function getUrlParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

async function loadVideoData(videoId) {
  if (videoDataCache.has(videoId)) {
    return videoDataCache.get(videoId);
  }
  
  try {
    const response = await fetch(`data/${videoId}.json`);
    if (!response.ok) {
      throw new Error(`无法加载视频 ${videoId}`);
    }
    const data = await response.json();
    videoDataCache.set(videoId, data);
    return data;
  } catch (error) {
    console.error('加载视频数据失败:', error);
    videoDataCache.set(videoId, null);
    return null;
  }
}

function initWaline(videoId) {
  const container = document.getElementById('waline-container');
  if (!container) return;
  
  if (walineInstance) {
    walineInstance.destroy();
    walineInstance = null;
  }
  
  walineInstance = Waline.init({
    el: '#waline-container',
    serverURL: 'https://pl-iota-three.vercel.app/',
    path: `video-${videoId}`,
    lang: 'zh-CN',
    dark: 'auto',
    comment: true,
    requiredMeta: ['nick', 'mail'],
    visitor: true,
    pageSize: 10,
    placeholder: '说点什么吧...',
    uploadImage: false,
    emoji: [
      'https://unpkg.com/@waline/emojis@1.1.0/weibo',
      'https://unpkg.com/@waline/emojis@1.1.0/bilibili',
    ],
    requiredFields: ['nick', 'mail'],
    wordLimit: '[0, 200]',
    preview: { isMobile: false },
    meta: ['nick', 'mail', 'link'],
    copyright: true,
  });
}

function initWalineList() {
  const container = document.getElementById('waline-list-container');
  if (!container) return;
  
  if (walineListInstance) {
    walineListInstance.destroy();
    walineListInstance = null;
  }
  
  walineListInstance = Waline.init({
    el: '#waline-list-container',
    serverURL: 'https://pl-iota-three.vercel.app/',
    path: 'home',
    lang: 'zh-CN',
    dark: 'auto',
    comment: true,
    requiredMeta: ['nick', 'mail'],
    visitor: true,
    pageSize: 10,
    placeholder: '说点什么吧...',
    uploadImage: false,
    emoji: [
      'https://unpkg.com/@waline/emojis@1.1.0/weibo',
      'https://unpkg.com/@waline/emojis@1.1.0/bilibili',
    ],
    requiredFields: ['nick', 'mail'],
    wordLimit: '[0, 200]',
    preview: { isMobile: false },
    meta: ['nick', 'mail', 'link'],
    copyright: true,
  });
}

async function scanVideoFiles() {
  const videoList = [];
  const loadPromises = [];
  
  for (let videoId = 1; videoId <= maxVideoId; videoId++) {
    loadPromises.push(
      loadVideoData(videoId).then(data => {
        if (data) {
          return {
            id: videoId,
            title: data.title || `视频${videoId}`,
            description: data.description || '',
            coverImage: data.coverImage || '',
            videoUrl: data.videoUrl || ''
          };
        }
        return null;
      })
    );
  }
  
  const results = await Promise.all(loadPromises);
  results.forEach(result => {
    if (result) {
      videoList.push(result);
    }
  });
  
  return videoList;
}

function updateUrlParam(videoId, page) {
  const url = new URL(window.location.href);
  if (videoId) {
    url.searchParams.set('id', videoId);
  } else {
    url.searchParams.delete('id');
  }
  
  if (page) {
    url.searchParams.set('page', page);
  } else {
    url.searchParams.delete('page');
  }
  
  window.history.pushState({ videoId, page }, '', url);
}

window.addEventListener('DOMContentLoaded', async function() {
  videos = await scanVideoFiles();
  
  const videoId = parseInt(getUrlParam('id'));
  
  if (videoId) {
    await showVideoPage(videoId);
  } else {
    showListPage();
    
    const pageParam = parseInt(getUrlParam('page'));
    if (pageParam && pageParam > 0) {
      currentPage = pageParam;
    }
    
    renderVideoList();
    initWalineList();
  }
  
  bindCloseEvents();
});

function showListPage() {
  const listPage = document.getElementById('list-page');
  const videoPage = document.getElementById('video-page');
  
  if (listPage) listPage.style.display = 'block';
  if (videoPage) videoPage.style.display = 'none';
  
  const url = new URL(window.location.href);
  url.searchParams.delete('id');
  window.history.replaceState({}, '', url);
}

async function showVideoPage(videoId) {
  const listPage = document.getElementById('list-page');
  const videoPage = document.getElementById('video-page');
  
  if (listPage) listPage.style.display = 'none';
  if (videoPage) videoPage.style.display = 'block';
  
  const videoData = await loadVideoData(videoId);
  
  if (!videoData) {
    alert('视频不存在');
    showListPage();
    return;
  }
  
  const titleEl = document.getElementById('video-title');
  const descEl = document.getElementById('video-description');
  
  if (titleEl) titleEl.textContent = videoData.title || `视频${videoId}`;
  if (descEl) descEl.textContent = videoData.description || '';
  
  initWaline(videoId);
  
  if (videoData.videoUrl && videoData.videoUrl.trim() !== '') {
    openVideo(videoData.videoUrl);
  } else {
    alert('视频链接无效');
    showListPage();
  }
}

function bindCloseEvents() {
  const backBtn = document.getElementById('back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', function() {
      showListPage();
      initWalineList();
    });
  }
}

function renderVideoList() {
  const container = document.getElementById('highlights-container');
  if (container) {
    container.innerHTML = '';
    
    const startIndex = (currentPage - 1) * videosPerPage;
    const endIndex = startIndex + videosPerPage;
    const currentVideos = videos.slice(startIndex, endIndex);
    
    if (currentVideos.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #999;">暂无视频</p>';
      return;
    }
    
    currentVideos.forEach(video => {
      const card = document.createElement('div');
      card.className = 'highlight-card';
      
      const hasCoverImage = video.coverImage && video.coverImage.trim() !== '';
      const coverImageHTML = hasCoverImage ? 
        `<img class="cover-image loading" src="" data-src="${video.coverImage}" alt="${video.title}" data-id="${video.id}" data-video="${video.videoUrl}" loading="lazy">` : 
        '<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #999;">暂无封面</div>';
      
      const hasVideoUrl = video.videoUrl && video.videoUrl.trim() !== '';
      const playButtonHTML = hasVideoUrl ? 
        `<button class="play-btn" data-id="${video.id}">播放视频</button>` : 
        '<button class="play-btn" disabled style="background-color: #999; cursor: not-allowed;">敬请期待</button>';
      
      card.innerHTML = `
        <div class="image-container">
          ${hasCoverImage ? '<div class="loading-spinner"></div>' : ''}
          ${coverImageHTML}
        </div>
        <div class="card-content">
          <h3>${video.title}</h3>
          <p>${video.description}</p>
          ${playButtonHTML}
        </div>
      `;
      container.appendChild(card);
    });

    lazyLoadImages();
    renderPagination();
    bindVideoEvents();
  }
}

function lazyLoadImages() {
  const images = document.querySelectorAll('.cover-image[data-src]');
  
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const src = img.getAttribute('data-src');
        
        if (src) {
          img.src = src;
          img.addEventListener('load', function() {
            this.classList.remove('loading');
            const spinner = this.parentElement.querySelector('.loading-spinner');
            if (spinner) spinner.style.display = 'none';
          });
          
          img.addEventListener('error', function() {
            this.style.display = 'none';
            const container = this.parentElement;
            const noCoverDiv = document.createElement('div');
            noCoverDiv.style.cssText = 'width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #999;';
            noCoverDiv.textContent = '暂无封面';
            container.appendChild(noCoverDiv);
            const spinner = container.querySelector('.loading-spinner');
            if (spinner) spinner.style.display = 'none';
          });
        }
        
        observer.unobserve(img);
      }
    });
  }, { rootMargin: '50px 0px', threshold: 0.1 });
  
  images.forEach(img => imageObserver.observe(img));
}

function renderPagination() {
  const pagination = document.getElementById('pagination');
  if (pagination) {
    pagination.innerHTML = '';
    
    const totalPages = Math.ceil(videos.length / videosPerPage);
    
    if (totalPages <= 1) return;
    
    if (currentPage > 1) {
      const prevBtn = document.createElement('button');
      prevBtn.className = 'pagination-btn';
      prevBtn.textContent = '上一页';
      prevBtn.onclick = function() { goToPage(currentPage - 1); };
      pagination.appendChild(prevBtn);
    }
    
    for (let i = 1; i <= totalPages; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.className = 'pagination-btn' + (i === currentPage ? ' active' : '');
      pageBtn.textContent = i;
      pageBtn.onclick = function() { goToPage(i); };
      pagination.appendChild(pageBtn);
    }
    
    if (currentPage < totalPages) {
      const nextBtn = document.createElement('button');
      nextBtn.className = 'pagination-btn';
      nextBtn.textContent = '下一页';
      nextBtn.onclick = function() { goToPage(currentPage + 1); };
      pagination.appendChild(nextBtn);
    }
  }
}

function goToPage(page) {
  currentPage = page;
  updateUrlParam(null, page);
  renderVideoList();
  window.scrollTo(0, 0);
}

function bindVideoEvents() {
  document.querySelectorAll('.cover-image').forEach(img => {
    img.addEventListener('click', function() {
      const videoId = this.getAttribute('data-id');
      if (videoId) {
        window.location.href = `?id=${videoId}`;
      }
    });
  });

  document.querySelectorAll('.play-btn').forEach(btn => {
    const videoId = btn.getAttribute('data-id');
    if (videoId) {
      btn.addEventListener('click', function() {
        window.location.href = `?id=${videoId}`;
      });
    }
  });
}

function bindCloseEvents() {
  const closeBtn = document.getElementById('close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      closeVideo();
      showListPage();
      initWalineList();
    });
  }
  
  const backBtn = document.getElementById('back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', function() {
      closeVideo();
      showListPage();
      initWalineList();
    });
  }
}

function openVideo(videoUrl) {
  try {
    if (!videoUrl || videoUrl.trim() === '') {
      alert('视频链接无效，请稍后再试');
      return;
    }
    
    closeVideo();
    
    const videoPlayer = document.getElementById('video-player');
    if (!videoPlayer) {
      console.error('视频播放器不存在');
      return;
    }
    
    currentPlayer = videojs('video-player', {
      controls: true,
      autoplay: true,
      preload: 'auto',
      responsive: true,
      fluid: true
    });
    
    currentPlayer.on('error', function() {
      console.error('视频加载失败:', currentPlayer.error());
      alert('视频加载失败，可能是因为网络问题或格式不支持');
    });
    
    currentPlayer.src(videoUrl);
    currentPlayer.play();
  } catch (error) {
    console.error('打开视频失败:', error);
    alert('视频播放失败，请稍后再试');
  }
}

function closeVideo() {
  try {
    if (currentPlayer) {
      currentPlayer.pause();
      currentPlayer.dispose();
      currentPlayer = null;
    }
    
    updateUrlParam(null);
  } catch (error) {
    console.error('关闭视频失败:', error);
  }
}
