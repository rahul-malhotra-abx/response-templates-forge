// Setting error logging.
console.error = function () {
  console.log('RT [E]:', ...arguments);
};

const resizeChecker = setInterval(() => {
  if (document.getElementById('response-template-wrapper')) {
    clearInterval(resizeChecker);
    new ResizeSensor(document.getElementById('response-template-wrapper'), async function () {
      if (window.AP && window.AP.context) {
        const context = await window.AP.context.getContext();
        if (context.jira.issue) {
          // Inside Jira Issue.
          const currentHeight = document.getElementById('response-template-wrapper').offsetHeight;
          if (currentHeight) {
            window.AP.resize('100%', currentHeight < 65 ? 65 : currentHeight + 'px');
          }
        }
      }
    });
  }
});

function getParentDomain() {
  let domain = window.location.origin;
  try {
    domain = document.location.ancestorOrigins[0] || window.location.origin;
  } catch (e) {}
  return domain;
}

const isLocalhost = ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);

// Google Analytics
if (!isLocalhost) {
  (function (i, s, o, g, r, a, m) {
    i['GoogleAnalyticsObject'] = r;
    i[r] =
      i[r] ||
      function () {
        (i[r].q = i[r].q || []).push(arguments);
      };
    i[r].l = 1 * new Date();
    a = s.createElement(o);
    m = s.getElementsByTagName(o)[0];
    a.async = 1;
    a.src = g;
    m.parentNode.insertBefore(a, m);
  })(window, document, 'script', 'https://www.google-analytics.com/analytics.js', 'ga');
}

(async () => {
  if (isLocalhost) {
    return;
  }
  let userId;
  ga('create', 'UA-181882142-5', {
    storage: 'none',
    clientId: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0,
        v = c == 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    }),
  });
  setTimeout(async () => {
    if (window.parent !== window) {
      try {
        userId = await window.AP.getCurrentUser();
      } catch (e) {
        userId = 'anonymous';
      }
    } else {
      userId = 'anonymous';
    }
    ga('set', 'userId', userId);
  }, 2000);
})();

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

// <!-- Google Tag Manager -->
window.dataLayer = window.dataLayer || [];
if (!isLocalhost) {
  (function (w, d, s, l, i) {
    w[l] = w[l] || [];
    w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    var f = d.getElementsByTagName(s)[0],
      j = d.createElement(s),
      dl = l != 'dataLayer' ? '&l=' + l : '';
    j.async = true;
    j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
    f.parentNode.insertBefore(j, f);
  })(window, document, 'script', 'dataLayer', 'GTM-WZJP2ZW');
}
