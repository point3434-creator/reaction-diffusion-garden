() => {
  const checks = [];
  function check(name, pass, detail) { checks.push({name, pass: !!pass, detail: detail || ''}); }
  const panel = document.getElementById('panel');
  check('control panel exists', panel);
  if (!panel) return checks;
  const css = getComputedStyle(panel);
  const rgba = css.backgroundColor.match(/[\d.]+/g) || [];
  const alpha = rgba.length === 4 ? Number(rgba[3]) : 1;
  check('panel tint is translucent, not opaque', alpha > 0 && alpha <= .67, css.backgroundColor);
  check('backdrop is blurred, foreground is not', css.backdropFilter.includes('blur(') && css.filter === 'none', css.backdropFilter);
  check('panel and foreground remain fully opaque', css.opacity === '1');
  const art = panel.querySelectorAll('.panel-botany');
  check('two botanical accents belong to the panel', art.length === 2, 'count=' + art.length);
  check('old stage vines are removed', !document.querySelector('.stage .garden-vine, .stage > .vine'));
  check('botanical artwork cannot intercept input', Array.from(art).every(a => getComputedStyle(a).pointerEvents === 'none' && a.getAttribute('aria-hidden') === 'true'));
  const active = document.querySelector('#chem [aria-pressed="true"]');
  if (active) {
    const s = getComputedStyle(active), a = s.backgroundColor.match(/[\d.]+/g) || [];
    check('selected button uses tinted glass, not solid fill', a.length === 4 && Number(a[3]) < .9, s.backgroundColor);
    check('selected control label stays opaque', s.opacity === '1');
    check('buttons have a glass highlight', s.backgroundImage !== 'none' && s.boxShadow !== 'none');
  }
  const bounds = panel.getBoundingClientRect();
  check('panel fits the viewport horizontally', bounds.left >= -1 && bounds.right <= innerWidth + 1, JSON.stringify({left:bounds.left,right:bounds.right,width:innerWidth}));
  check('panel stays within the viewport vertically when open', bounds.top >= -1 && bounds.bottom <= innerHeight + 1, JSON.stringify({top:bounds.top,bottom:bounds.bottom,height:innerHeight}));
  const panes = document.querySelector('.tabpanes');
  check('controls scroll inside the panel', panes.scrollHeight <= panes.clientHeight + 1 || ['auto','scroll'].includes(getComputedStyle(panes).overflowY));
  check('no horizontal overflow in controls', panes.scrollWidth <= panes.clientWidth + 2, `${panes.scrollWidth}/${panes.clientWidth}`);
  const button = document.querySelector('[data-tab="look"]');
  if (button) {
    const r = button.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2,r.y + r.height / 2);
    check('decorations do not cover tab hit targets', button === hit || button.contains(hit));
  }
  const realLabels = ['#lab1','#lab2','.eyebrow','.tab-btn'];
  check('text is never faded with container opacity', realLabels.every(sel => {
    const el = document.querySelector(sel); if (!el) return true;
    for (let p = el; p && p !== document.body; p = p.parentElement) if (Number(getComputedStyle(p).opacity) < 1) return false;
    return true;
  }));
  return checks;
}
