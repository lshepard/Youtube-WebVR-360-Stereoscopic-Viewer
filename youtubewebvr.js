﻿///<reference path="three.js"/>
///<reference path="UI.js"/>
///<reference path="PanoramaViewer.js"/>
///<reference path="MouseKeyboard.js"/>
///<reference path="YoutubePageContextScript.js"/>
///<reference path="chromeStorage.js"/>

window.console.log = function() {}
var cvRafId;
var youtubePlayerState = 1;
var isEmbed = false;
var videoContainer, video, videoWidth, videoHeight, videoTitle = '';
var videoId;
var vrHMD = 'getVRDeivce not yet', vrPositionSensor;
var PLAYER_VERSION_OLD = 'OLD';
var PLAYER_VERSION_20150801 = '20150801';
var playerVersion = PLAYER_VERSION_20150801;

function getVRDisplays() {
  return new Promise(function(resolve, reject){
    var isReady = vrHMD === 'ready';
    vrHMD = null;
    if (navigator.getVRDisplays) {
      navigator.getVRDisplays().then(function (devices) {
        for (var i = 0; i < devices.length; i++) {
          if (devices[i].capabilities.hasExternalDisplay) {
            vrHMD = devices[i];
            eyeFOVL = vrHMD.getEyeParameters('left');
            eyeFOVR = vrHMD.getEyeParameters('right');
            break;
          }
        }
        for (var i = 0; i < devices.length; i++) {
          if (devices[i].capabilities.hasPosition) {
            vrPositionSensor = devices[i];
          }
        }
      });
    }
    if (isReady) {
      viewerInfo.isPanorama = true;
      youtubeSwitchViewer();
    }
  });
}

window.addEventListener('wdoYoutubePlayerReady', function (event) {
  detectChangeVideo();
}, false);

window.addEventListener('wdoChangeStateYoutubePlayer', function (event) {
  youtubePlayerState = event.detail;

  if (youtubePlayerState === -1) {
    detectChangeVideo();
  }

}, false);

window.addEventListener('wdoGetCurrentTimeYoutubePlayerResponse', function (event) {
  callback(event.detail);
}, false);

window.addEventListener('wdoOpenOculusWindowResponse', function (event) {
  //chrome.runtime.sendMessage({ action: ACTION_OPEN_OCULUS_WINDOW, mediaUrl: mediaUrl, currentTime: event.detail });
}, false);

window.addEventListener('wdoBeginCloseOculusWindowResponse', function (event) {
  //chrome.runtime.sendMessage({ action: ACTION_CLOSE_OCULUS_WINDOW, currentTime: event.detail });
}, false);

function detectChangeVideo() {
  cvRafId = requestAnimationFrame(detectChangeVideo);
  var title = document.getElementById('eow-title') || document.getElementsByClassName('html5-title-text')[0];
  toolTipText = document.querySelector('.ytp-tooltip-text');
  toolTip = toolTipText.parentElement.parentElement;
  toolTip.className = 'ytp-tooltip ytp-bottom';
  if (title && title.textContent !== videoTitle) {
    cancelAnimationFrame(cvRafId);
    initViewer();
  }
}

//if (!cvRafId) {
//  detectChangeVideo();
//}

function initViewer() {
  isEmbed = location.href.indexOf('https://www.youtube.com/embed/') !== -1;
  player = document.getElementById('movie_player');
  var title = document.getElementById('eow-title') || document.getElementsByClassName('html5-title-text')[0];
  videoContainer = document.getElementsByClassName('html5-video-container')[0];
  video = document.getElementsByTagName('video')[0];
  if (!title.textContent) {
    disposePanoramaViewer();
    return;
  }
  buttonContainer = document.getElementsByClassName('html5-player-chrome')[0];
  if (buttonContainer) {
    playerVersion = PLAYER_VERSION_OLD;
  } else {
    buttonContainer = document.getElementsByClassName('ytp-chrome-controls')[0];
  }

  videoTitle = title.textContent;
  viewerInfo.reset();
  getViewerInfo(videoTitle);
  getVRDisplays();
  //if(!vrHMD)

  //disposePanoramaViewer();
  createOrResetPanoramaViewer();
  createOrResetPanoramaButton();
  createOrResetOculusButton();
  createOrResetPanoramaModeLabel();
  createOrResetPositionTrackingScaleLabel();

  if (vrHMD !== 'getVRDeivce not yet'){
    viewerInfo.isPanorama = true;
    youtubeSwitchViewer();
  } else {
    vrHMD = 'ready';
  }

  if (video.src.indexOf('googlevideo.com/videoplayback') !== -1) {
    btnPanorama.style.display = 'none';
    lblPanoramaMode.style.display = '';
    lblPanoramaMode.textContent = 'Warning: Different domain a video source.'
  } else {
    btnPanorama.style.display = '';
    lblPanoramaMode.style.display = 'none';
  }

}

function getViewerInfo(title) {
  videoId = video.baseURI;
  var ms = title.match(/【(.*?)】/g);
  if (!ms) return;
  for (var i = ms.length; i--;) {
    var m = ms[i].toLowerCase();
    viewerInfo.flipH = viewerInfo.flipV = m.indexOf('fb') !== -1;
    viewerInfo.flipH = m.indexOf('fh') !== -1;
    viewerInfo.flipV = m.indexOf('fv') !== -1;
    viewerInfo.swapEye = m.indexOf('se') !== -1;
    if(m.indexOf('sbs') !== -1){
      viewerInfo.mode = MODE_SIDE_BY_SIDE;
    } else if(m.indexOf('tb') !== -1 || m.indexOf('tab') !== -1){
      viewerInfo.mode = MODE_TOP_AND_BOTTOM;
    } else if (m.indexOf('theta') !== -1 || m.indexOf('Θ') !== -1) {
      if (m.indexOf('m15') !== -1) {
        viewerInfo.mode = MODE_RAW_THETA;
        thetaRadius = 0.905;
        xLOffset = 0.242;
        yLOffset = 0.625;
        xROffset = 0.747;
        yROffset = 0.625;
        //changeTHETAUniforms(0.905, 0.242, 0.625, 0.747, 0.625);
      } else {
        viewerInfo.mode = MODE_RAW_THETA_S;
        thetaRadius = 0.821;
        xLOffset = 0.2913;
        yLOffset = 0.62;
        xROffset = 0.7536;
        yROffset = 0.62;
        //changeTHETAUniforms(0.821, 0.2913, 0.62, 0.7536, 0.62);
      }
    }
  }
}

function youtubeSwitchViewer() {
  if (viewerInfo.isPanorama) {
    viewerInfo.isPanorama = false;
    btnPanoramaPath.setAttributeNS(null, 'd', changeToPanoramaViewerSVG);
    if (isEmbed) {
      document.getElementsByTagName('video')[0].style.display = '';
    } else {
      videoContainer.style.display = '';
    }
    renderer.domElement.style.display = 'none';
    btnOculus.style.display = 'none'; //vrHMD && vrHMD.deviceName !== 'Mockulus Rift' ? '' : 'none';
    lblPanoramaMode.style.display = 'none';

    stopRender();
  } else {
    viewerInfo.isPanorama = true;
    btnPanoramaPath.setAttributeNS(null, 'd', returnToYoutubePlayerSVG);
    btnOculus.style.display = vrHMD && vrHMD.deviceName !== 'Mockulus Rift' ? '' : 'none';
    lblPanoramaMode.style.display = '';
    videoContainer.parentNode.appendChild(renderer.domElement);
    videoContainer.style.display = 'none';
    renderer.domElement.style.display = '';
    startRender();
  }
}

function urlArgParse(url) {
  var res = null;
  url.substr(url.lastIndexOf('?') + 1).split('&').forEach(function (kvp) {
    if (!kvp) return;
    var arr = kvp.split('=');
    res = res || {};
    res[arr[0]] = arr[1];
  });
  return res;
}
