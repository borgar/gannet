/* globals document WebSocket location */
(function () {
  function reValue (value) {
    value = value.replace(/([&?]forceReload=\d+|#.*$)/gi, '');
    const sep = value.includes('?') ? '&' : '?';
    // eslint-disable-next-line
    console.info('RELOAD', value);
    return `${value}${sep}forceReload=${Date.now()}`;
  }

  function reLoadElms (selector) {
    Array.from(document.querySelectorAll(selector)).forEach(elm => {
      if (elm.href) {
        elm.href = reValue(elm.href);
      }
      else if (elm.src) {
        elm.src = reValue(elm.src);
      }
    });
  }

  function connect () {
    const ws = new WebSocket(`ws://${location.host}`);
    ws.addEventListener('close', () => {
      setTimeout(connect, 1000);
    });
    ws.addEventListener('message', ({ data }) => {
      if (/\.css$/.test(data.file)) {
        reLoadElms('link[rel=stylesheet]');
      }
      else if (/\.(gif|jpe?g|png)$/.test(data.file)) {
        reLoadElms('img');
      }
      else {
        location.reload();
      }
    });
  }
  connect();
})();

