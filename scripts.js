let videos = [];
let currentPlayer = null;
let currentPage = 1;
const videosPerPage = 5;
const videoDataCache = new Map();
let walineInstance = null;
let isNavigating = false;
let toastTimeout = null;

function getUrlParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  let value = urlParams.get(name);
  
  if (name === 'id') {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1 || num > 1000) {
      return null;
    }
    return num;
  }
  
  if (name === 'page') {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1) {
      return null;
    }
    return num;
  }
  
  return value;
}

function showToast(message, duration = 3000) {
  let toast = document.querySelector('.toast-message');
  
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }
  
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast-message';
    document.body.appendChild(toast);
  }
  
  toast.textContent = message;
  toast.style.display = 'block';
  toast.style.opacity = '1';
  
  toastTimeout = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 300);
  }, duration);
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
  
  setTimeout(() => {
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
  }, 300);
}

async function scanVideoFiles() {
  const videoList = [];
  
  try {
    const response = await fetch('data/index.json');
    if (!response.ok) {
      throw new Error('无法加载索引文件');
    }
    const indexData = await response.json();
    const videoIds = indexData.videos || [];
    
    if (videoIds.length === 0) {
      console.log('索引文件为空');
      return videoList;
    }
    
    const loadPromises = videoIds.map(videoId => {
      return loadVideoData(videoId).then(data => {
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
      });
    });
    
    const results = await Promise.all(loadPromises);
    results.forEach(result => {
      if (result) {
        videoList.push(result);
      }
    });
    
  } catch (error) {
    console.error('加载索引文件失败:', error);
    return videoList;
  }
  
  return videoList;
}

function navigateTo(page, pageNum = null) {
  if (isNavigating) return;
  isNavigating = true;
  
  const url = new URL(window.location.href);
  
  if (page === 'video') {
    url.searchParams.set('id', pageNum);
  } else if (page === 'list') {
    url.searchParams.delete('id');
    if (pageNum && pageNum > 1) {
      url.searchParams.set('page', pageNum);
    } else {
      url.searchParams.delete('page');
    }
  }
  
  window.history.pushState({ page, videoId: pageNum, listPage: currentPage }, '', url);
  
  setTimeout(() => {
    isNavigating = false;
  }, 100);
}

window.addEventListener('popstate', function(event) {
  if (event.state) {
    if (event.state.page === 'video' && event.state.videoId) {
      showVideoPage(event.state.videoId);
    } else {
      currentPage = event.state.listPage || 1;
      showListPage();
    }
  } else {
    currentPage = 1;
    showListPage();
  }
});

window.addEventListener('DOMContentLoaded', async function() {
  videos = await scanVideoFiles();
  
  const videoId = getUrlParam('id');
  const pageParam = getUrlParam('page');
  
  if (pageParam) {
    currentPage = pageParam;
  }
  
  if (videoId) {
    await showVideoPage(videoId);
  } else {
    showListPage();
  }
  
  bindCloseEvents();
});

function showListPage(restoreScroll = true) {
  const listPage = document.getElementById('list-page');
  const videoPage = document.getElementById('video-page');
  
  if (listPage) listPage.style.display = 'block';
  if (videoPage) videoPage.style.display = 'none';
  
  if (currentPlayer) {
    currentPlayer.pause();
  }
  
  if (restoreScroll && window.scrollY > 0) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  
  document.title = '历史高光';
  
  renderVideoList();
}

async function showVideoPage(videoId) {
  if (isNavigating) return;
  isNavigating = true;
  
  const listPage = document.getElementById('list-page');
  const videoPage = document.getElementById('video-page');
  
  if (listPage) listPage.style.display = 'none';
  if (videoPage) videoPage.style.display = 'block';
  
  showVideoLoading(true);
  
  const videoData = await loadVideoData(videoId);
  
  if (!videoData) {
    showVideoLoading(false);
    showToast('视频不存在');
    navigateTo('list', currentPage);
    setTimeout(() => {
      showListPage(false);
    }, 100);
    isNavigating = false;
    return;
  }
  
  const titleEl = document.getElementById('video-title');
  const descEl = document.getElementById('video-description');
  
  if (titleEl) titleEl.textContent = videoData.title || `视频${videoId}`;
  if (descEl) descEl.textContent = videoData.description || '';
  
  document.title = `${videoData.title || `视频${videoId}`} - 历史高光`;
  
  initWaline(videoId);
  
  if (videoData.videoUrl && videoData.videoUrl.trim() !== '') {
    setupVideo(videoData.videoUrl);
    showVideoLoading(false);
  } else {
    showVideoLoading(false);
    showToast('视频链接无效');
    navigateTo('list', currentPage);
    setTimeout(() => {
      showListPage(false);
    }, 100);
  }
  
  isNavigating = false;
}

function showVideoLoading(show) {
  const playerWrapper = document.querySelector('.video-player-wrapper');
  if (!playerWrapper) return;
  
  let loadingEl = playerWrapper.querySelector('.video-loading');
  
  if (show) {
    if (!loadingEl) {
      loadingEl = document.createElement('div');
      loadingEl.className = 'video-loading';
      loadingEl.innerHTML = `
        <div class="loading-spinner-large"></div>
        <div class="loading-text">视频加载中...</div>
      `;
      playerWrapper.appendChild(loadingEl);
    }
    loadingEl.style.display = 'flex';
  } else {
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }
  }
}

function renderVideoList() {
  const container = document.getElementById('highlights-container');
  if (container) {
    container.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner-large"></div>
        <div class="loading-text">加载中...</div>
      </div>
    `;
    
    setTimeout(() => {
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
          `<img class="cover-image loading" src="" data-src="${video.coverImage}" alt="${video.title}" loading="lazy">` : 
          '<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #999;">暂无封面</div>';
        
        const hasVideoUrl = video.videoUrl && video.videoUrl.trim() !== '';
        const playButtonHTML = hasVideoUrl ? 
          `<button class="play-btn" data-id="${video.id}">播放视频</button>` : 
          '<button class="play-btn" disabled style="background-color: #999; cursor: not-allowed;">敬请期待</button>';
        
        card.innerHTML = `
          <div class="image-container" data-id="${video.id}">
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
    }, 100);
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
  navigateTo('list', page);
  renderVideoList();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindVideoEvents() {
  document.querySelectorAll('.image-container').forEach(container => {
    container.addEventListener('click', function() {
      const videoId = this.getAttribute('data-id');
      if (videoId) {
        navigateTo('video', parseInt(videoId));
        showVideoPage(parseInt(videoId));
      }
    });
  });

  document.querySelectorAll('.play-btn').forEach(btn => {
    const videoId = btn.getAttribute('data-id');
    if (videoId) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        navigateTo('video', parseInt(videoId));
        showVideoPage(parseInt(videoId));
      });
    }
  });
}

function bindCloseEvents() {
  const backBtn = document.getElementById('back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', function() {
      navigateTo('list', currentPage);
      showListPage(true);
    });
  }
}

function setupVideo(videoUrl) {
  try {
    if (!videoUrl || videoUrl.trim() === '') {
      showToast('视频链接无效，请稍后再试');
      return;
    }
    
    const videoPlayer = document.getElementById('video-player');
    if (!videoPlayer) {
      console.error('视频播放器不存在');
      showToast('播放器初始化失败');
      return;
    }
    
    if (currentPlayer) {
      currentPlayer.dispose();
    }
    
    currentPlayer = videojs('video-player', {
      controls: true,
      autoplay: false,
      preload: 'none',
      fluid: true,
      responsive: true
    });
    
    currentPlayer.on('waiting', function() {
      showVideoLoading(true);
    });
    
    currentPlayer.on('canplay', function() {
      showVideoLoading(false);
    });
    
    currentPlayer.on('error', function() {
      showVideoLoading(false);
      showToast('视频加载失败，请稍后再试');
    });
    
    currentPlayer.src({
      src: videoUrl,
      type: 'video/mp4'
    });
    
  } catch (error) {
    console.error('设置视频失败:', error);
    showToast('视频设置失败，请稍后再试');
  }
}
