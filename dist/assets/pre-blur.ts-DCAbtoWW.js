(function(){const t=document.createElement("style");t.id="pg-patrol-pre-blur";t.textContent=`
  body { visibility: hidden; }
  img:not([data-pg-patrol-img-processed]),
  video:not([data-pg-patrol-vid-processed]) {
    filter: blur(20px) !important;
    transition: filter 0.3s ease;
  }
`;(document.head||document.documentElement).appendChild(t);
})()
