const App = {
  videos: [],
  currentPlayer: null,
  currentPage: 1,
  videosPerPage: 5,
  videoDataCache: new Map(),
  walineInstance: null,
  currentVideoId: null,
  debounceTimer: null,
  
  init() {
    window.addEventListener('DOMContentLoaded', () => this.handleDOMContentLoaded());
    window.addEventListener('popstate', (e) => this.handlePopState(e));
    document.addEventListener('keydown', (e) => this.handleKeydown(e));
    document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
  },
  
  handleDOMContentLoaded() {
    this.scanVideoFiles().then(() => {
      const videoId = this.getValidVideoId();
      if (videoId) {
        this.showVideoPage(videoId);
      } else {
        this.currentPage = this.getValidPage();
        this.showListPage();
        this.renderVideoList();
      }
      this.bindCloseEvents();
    });
  },
  
  handlePopState(e) {
    if (e.state && e.state.videoId) {
      this.showVideoPage(e.state.videoId);
    } else {
      this.showListPage();
      this.currentPage = e.state?.page || 1;
      this.renderVideoList();
    }
  },
  
  getUrlParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  },
  
  getValidVideoId() {
    const param = this.getUrlParam('id');
    if (!param) return null;
    
    const videoId = parseInt(param, 10);
    return videoId > 0 && videoId <= 100 ? videoId : null;
  },
  
  getValidPage() {
    const param = this.getUrlParam('page');
    if (!param) return 1;
    
    const page = parseInt(param, 10);
    return page > 0 ? page : 1;
  },
  
  async loadVideoData(videoId) {
    if (this.videoDataCache.has(videoId)) {
      return this.videoDataCache.get(videoId);
    }
    
    try {
      const response = await fetch(`data/${videoId}.json`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      this.videoDataCache.set(videoId, data);
      return data;
    } catch (error) {
      console.error(`加载视频${videoId}失败:`, error);
      this.videoDataCache.set(videoId, null);
      return null;
    }
  },
  
  initWaline(videoId) {
    const container = document.getElementById('waline-container');
    if (!container) return;
    
    if (this.walineInstance) {
      this.walineInstance.destroy();
      this.walineInstance = null;
    }
    
    this.walineInstance = Waline.init({
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
  },
  
  async scanVideoFiles() {
    try {
      const response = await fetch('data/index.json');
      if (!response.ok) throw new Error('无法加载索引');
      
      const indexData = await response.json();
      const videoIds = indexData.videos || [];
      
      if (videoIds.length === 0) {
        console.log('索引文件为空');
        return;
      }
      
      const loadPromises = videoIds.map(id => 
        this.loadVideoData(id).then(data => data ? ({
          id,
          title: data.title || `视频${id}`,
          description: data.description || '',
          coverImage: data.coverImage || '',
          videoUrl: data.videoUrl || ''
        }) : null)
      );
      
      const results = await Promise.all(loadPromises);
      this.videos = results.filter(Boolean);
      
    } catch (error) {
      console.error('加载视频列表失败:', error);
    }
  },
  
  updateUrlParam(videoId, page) {
    const url = new URL(window.location.href);
    videoId ? url.searchParams.set('id', videoId) : url.searchParams.delete('id');
    page ? url.searchParams.set('page', page) : url.searchParams.delete('page');
    window.history.pushState({ videoId, page }, '', url);
  },
  
  showListPage() {
    this.hideVideoLoading();
    
    document.getElementById('list-page')?.style.setProperty('display', 'block');
    document.getElementById('video-page')?.style.setProperty('display', 'none');
    
    const url = new URL(window.location.href);
    url.searchParams.delete('id');
    window.history.replaceState({}, '', url);
    
    this.destroyPlayer();
    document.title = '历史高光';
  },
  
  async showVideoPage(videoId) {
    this.currentVideoId = videoId;
    
    document.getElementById('list-page')?.style.setProperty('display', 'none');
    const videoPage = document.getElementById('video-page');
    if (videoPage) {
      videoPage.style.setProperty('display', 'block');
      videoPage.style.opacity = '0';
      setTimeout(() => { videoPage.style.opacity = '1'; }, 50);
    }
    
    this.showVideoLoading();
    
    try {
      const videoData = await this.loadVideoData(videoId);
      
      if (!videoData) {
        this.showError('视频不存在');
        return;
      }
      
      document.getElementById('video-title')?.textContent = videoData.title || `视频${videoId}`;
      document.getElementById('video-description')?.textContent = videoData.description || '';
      
      document.title = `${videoData.title || '视频'} - 历史高光`;
      
      this.updateNavigationButtons();
      this.bindShareButton();
      
      this.initWaline(videoId);
      
      if (videoData.videoUrl?.trim()) {
        this.setupVideo(videoData.videoUrl);
      } else {
        throw new Error('视频链接无效');
      }
      
    } catch (error) {
      console.error('显示视频页面失败:', error);
      this.showError(error.message);
    }
  },
  
  handleKeydown(e) {
    if (e.key === 'Escape' && document.getElementById('video-page')?.style.display === 'block') {
      this.showListPage();
    }
    
    if (e.key === 'ArrowLeft' && this.currentVideoId) {
      e.preventDefault();
      this.navigateVideo(-1);
    }
    
    if (e.key === 'ArrowRight' && this.currentVideoId) {
      e.preventDefault();
      this.navigateVideo(1);
    }
  },
  
  handleVisibilityChange() {
    if (document.hidden && this.currentPlayer) {
      this.currentPlayer.pause();
    }
  },
  
  navigateVideo(direction) {
    const currentIndex = this.videos.findIndex(v => v.id === this.currentVideoId);
    if (currentIndex === -1) return;
    
    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < this.videos.length) {
      window.location.href = `?id=${this.videos[newIndex].id}`;
    }
  },
  
  updateNavigationButtons() {
    const currentIndex = this.videos.findIndex(v => v.id === this.currentVideoId);
    const prevBtn = document.getElementById('prev-video');
    const nextBtn = document.getElementById('next-video');
    
    if (prevBtn) {
      prevBtn.disabled = currentIndex <= 0;
      prevBtn.onclick = () => this.navigateVideo(-1);
    }
    
    if (nextBtn) {
      nextBtn.disabled = currentIndex >= this.videos.length - 1;
      nextBtn.onclick = () => this.navigateVideo(1);
    }
  },
  
  bindShareButton() {
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
      shareBtn.onclick = async () => {
        const shareUrl = window.location.href;
        const shareText = document.getElementById('video-title')?.textContent || '视频';
        
        if (navigator.share) {
          try {
            await navigator.share({
              title: shareText,
              url: shareUrl
            });
          } catch (err) {
            console.log('分享取消');
          }
        } else {
          this.copyToClipboard(shareUrl);
        }
      };
    }
  },
  
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      alert('链接已复制到剪贴板！');
    } catch (err) {
      console.error('复制失败:', err);
      alert('复制失败，请手动复制链接');
    }
  },
  
  showVideoLoading() {
    const loadingEl = document.getElementById('video-loading');
    const playerWrapper = document.getElementById('video-player-wrapper');
    if (loadingEl) loadingEl.style.display = 'flex';
    if (playerWrapper) playerWrapper.style.opacity = '0.5';
  },
  
  hideVideoLoading() {
    const loadingEl = document.getElementById('video-loading');
    const playerWrapper = document.getElementById('video-player-wrapper');
    if (loadingEl) loadingEl.style.display = 'none';
    if (playerWrapper) playerWrapper.style.opacity = '1';
  },
  
  showError(message) {
    alert(message);
    this.hideVideoLoading();
    this.showListPage();
  },
  
  renderVideoList() {
    const container = document.getElementById('highlights-container');
    if (!container) return;
    
    container.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner-large"></div>
        <div class="loading-text">加载中...</div>
      </div>
    `;
    
    setTimeout(() => {
      container.innerHTML = '';
      
      const totalPages = Math.ceil(this.videos.length / this.videosPerPage);
      if (this.currentPage > totalPages && totalPages > 0) {
        this.currentPage = totalPages;
      }
      
      const startIndex = (this.currentPage - 1) * this.videosPerPage;
      const currentVideos = this.videos.slice(startIndex, startIndex + this.videosPerPage);
      
      if (currentVideos.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">暂无视频</p>';
        return;
      }
      
      currentVideos.forEach((video, index) => {
        const card = document.createElement('div');
        card.className = 'highlight-card';
        card.style.animationDelay = `${0.1 + index * 0.05}s`;
        
        const hasCover = video.coverImage?.trim();
        const hasVideoUrl = video.videoUrl?.trim();
        
        card.innerHTML = `
          <div class="image-container" data-id="${video.id}">
            ${hasCover ? '<div class="loading-spinner"></div>' : ''}
            ${hasCover 
              ? `<img class="cover-image loading" src="" data-src="${video.coverImage}" alt="${video.title}" loading="lazy">` 
              : '<div class="no-cover">暂无封面</div>'
            }
          </div>
          <div class="card-content">
            <h3>${video.title}</h3>
            <p>${video.description}</p>
            <button class="play-btn" ${hasVideoUrl ? `data-id="${video.id}"` : 'disabled'}>
              ${hasVideoUrl ? '播放视频' : '敬请期待'}
            </button>
          </div>
        `;
        container.appendChild(card);
      });
      
      this.lazyLoadImages();
      this.renderPagination();
      this.bindVideoEvents();
    }, 100);
  },
  
  lazyLoadImages() {
    const images = document.querySelectorAll('.cover-image[data-src]');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const src = img.getAttribute('data-src');
          
          if (src) {
            img.src = src;
            img.addEventListener('load', () => {
              img.classList.remove('loading');
              img.parentElement.querySelector('.loading-spinner')?.remove();
            });
            img.addEventListener('error', () => {
              img.remove();
              const noCover = document.createElement('div');
              noCover.className = 'no-cover';
              noCover.textContent = '暂无封面';
              img.parentElement.appendChild(noCover);
              img.parentElement.querySelector('.loading-spinner')?.remove();
            });
          }
          observer.unobserve(img);
        }
      });
    }, { rootMargin: '50px', threshold: 0.1 });
    
    images.forEach(img => observer.observe(img));
  },
  
  renderPagination() {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;
    
    pagination.innerHTML = '';
    const totalPages = Math.ceil(this.videos.length / this.videosPerPage);
    
    if (totalPages <= 1) return;
    
    if (this.currentPage > 1) {
      const prevBtn = this.createPaginationBtn('上一页', () => this.goToPage(this.currentPage - 1));
      pagination.appendChild(prevBtn);
    }
    
    for (let i = 1; i <= totalPages; i++) {
      const pageBtn = this.createPaginationBtn(i, () => this.goToPage(i), i === this.currentPage);
      pagination.appendChild(pageBtn);
    }
    
    if (this.currentPage < totalPages) {
      const nextBtn = this.createPaginationBtn('下一页', () => this.goToPage(this.currentPage + 1));
      pagination.appendChild(nextBtn);
    }
  },
  
  createPaginationBtn(text, onClick, isActive = false) {
    const btn = document.createElement('button');
    btn.className = `pagination-btn${isActive ? ' active' : ''}`;
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
  },
  
  goToPage(page) {
    this.currentPage = Math.max(1, Math.min(page, Math.ceil(this.videos.length / this.videosPerPage)));
    this.updateUrlParam(null, this.currentPage);
    this.renderVideoList();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
  
  bindVideoEvents() {
    document.querySelectorAll('.image-container, .play-btn[data-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.classList.contains('play-btn')) e.stopPropagation();
        const videoId = e.currentTarget.getAttribute('data-id') || e.target.getAttribute('data-id');
        if (videoId) {
          window.location.href = `?id=${videoId}`;
        }
      });
    });
  },
  
  bindCloseEvents() {
    document.getElementById('back-btn')?.addEventListener('click', () => {
      this.showListPage();
    });
  },
  
  setupVideo(videoUrl) {
    try {
      if (!videoUrl?.trim()) throw new Error('视频链接无效');
      
      const videoPlayer = document.getElementById('video-player');
      if (!videoPlayer) throw new Error('视频播放器不存在');
      
      this.destroyPlayer();
      
      this.currentPlayer = videojs('video-player', {
        controls: true,
        autoplay: false,
        preload: 'none',
        fluid: true,
        responsive: true,
        aspectRatio: 'auto'
      });
      
      this.currentPlayer.on('error', () => {
        console.error('视频加载失败');
        this.showError('视频加载失败');
      });
      
      this.currentPlayer.on('loadedmetadata', () => {
        this.hideVideoLoading();
      });
      
      this.currentPlayer.src({ src: videoUrl, type: 'video/mp4' });
      
    } catch (error) {
      console.error('设置视频失败:', error);
      this.hideVideoLoading();
      this.showError(error.message);
    }
  },
  
  destroyPlayer() {
    if (this.currentPlayer) {
      try {
        this.currentPlayer.dispose();
      } catch (e) {
        console.warn('销毁播放器失败:', e);
      }
      this.currentPlayer = null;
    }
  }
};

App.init();