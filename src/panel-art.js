/* Botanical glass illustration. Mounted once; no per-frame work and no audio/physics hooks.
   Hand-shaped leaf silhouettes use shaded folds, veins and dry-brush marks rather than
   identical flat icons. Everything is decorative and excludes itself from hit testing. */
(function installPanelArt() {
  'use strict';
  const panel = document.getElementById('panel');
  if (!panel || panel.dataset.botanicalGlass === '2') return;
  document.querySelectorAll('.stage > .garden-vine, .stage > .vine').forEach(el => el.remove());
  panel.dataset.botanicalGlass = '2';
  const palettes = [
    ['#193e31','#66875b','#b4c68d','#344f3d'],
    ['#25483f','#638a7a','#b8d2b3','#314f4c'],
    ['#544627','#b49857','#e1cb91','#766b43'],
    ['#442f48','#8e7085','#c8a8ad','#614c69'],
    ['#284e32','#81a368','#c9d595','#446a40']
  ];
  const shapes = [
    'M0 0 C-12 -7 -27 -18 -22 -41 C-18 -61 -4 -73 1 -94 C8 -72 25 -61 25 -38 C25 -17 11 -4 0 0Z',
    'M0 0 C-14 -6 -23 -22 -20 -43 C-15 -61 -3 -79 -2 -94 C9 -74 25 -59 22 -38 C21 -18 10 -5 0 0Z',
    'M0 0 C-7 -8 -29 -22 -23 -44 C-16 -68 -4 -77 3 -96 C7 -75 29 -58 24 -37 C21 -16 7 -5 0 0Z'
  ];
  function leaf(id, x, y, angle, length, width, palette, variant) {
    const [dark,mid,light,fold] = palettes[palette], shape = shapes[variant % 3];
    let marks = '';
    for (let k=0;k<8;k++) {
      const yy=-13-k*8.5, span=17*Math.sin((k+1)/10*Math.PI);
      marks += `<path d="M1 ${yy.toFixed(1)} Q${(-span*.55).toFixed(1)} ${(yy-7).toFixed(1)} ${(-span).toFixed(1)} ${(yy-14).toFixed(1)} M1 ${yy.toFixed(1)} Q${(span*.7).toFixed(1)} ${(yy-4).toFixed(1)} ${(span+3).toFixed(1)} ${(yy-13).toFixed(1)}" fill="none" stroke="${light}" stroke-opacity=".31" stroke-width=".65"/>`;
    }
    // Fixed, irregular dry-brush flecks; not randomized again on resize or tab change.
    for (let k=0;k<17;k++) {
      const yy=-10-((k*37+variant*11)%76), xx=-17+((k*13+variant*7)%34);
      marks += `<path d="M${xx} ${yy} l${2+k%4} ${-2-k%3}" stroke="${k%3 ? light : dark}" stroke-width="${.7+k%2*.6}" opacity=".12"/>`;
    }
    return `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${(length/94*width).toFixed(4)} ${(length/94).toFixed(4)})">
      <defs><linearGradient id="${id}-shade" x1="0" y1=".7" x2="1" y2=".25"><stop stop-color="${dark}"/><stop offset=".43" stop-color="${mid}"/><stop offset=".54" stop-color="${light}"/><stop offset=".64" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></linearGradient><clipPath id="${id}-clip"><path d="${shape}"/></clipPath></defs>
      <path d="${shape}" fill="url(#${id}-shade)" stroke="${dark}" stroke-width=".8"/>
      <g clip-path="url(#${id}-clip)"><path d="M0 0 Q-4 -31 1 -94 Q-2 -54 13 -27Z" fill="${fold}" opacity=".26"/>${marks}<path d="M0 0 Q3 -28 0 -54 T1 -94" fill="none" stroke="${light}" stroke-width=".95" opacity=".57"/></g>
      <path d="M0 3 Q-1 -1 0 -7" fill="none" stroke="${mid}" stroke-width="1.5"/>
    </g>`;
  }
  function art(where, viewbox, stems, leaves) {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="panel-botany botany-${where}" viewBox="${viewbox}" aria-hidden="true" focusable="false"><g fill="none" stroke-linecap="round"><path d="${stems}" stroke="#253c2c" stroke-width="2.5"/><path d="${stems}" stroke="#aaac75" stroke-width="1.15"/><path d="${stems}" stroke="#d3c493" stroke-width=".35"/></g>${leaves}</svg>`;
  }
  const crown = [
    [130,235,-61,52,.90,1], [135,207,48,37,.78,4],
    [129,180,-56,56,.88,0], [126,148,57,37,.75,2],
    [119,124,-62,44,.93,3], [128,94,41,37,.80,1],
    [137,67,-50,36,.81,4], [138,37,-22,32,.72,2],
    [96,164,-91,31,.80,4], [100,91,-83,30,.78,0]
  ].map((p,i)=>leaf('bg-c'+i,...p,i)).join('');
  panel.insertAdjacentHTML('beforeend', art('crown','0 0 156 252',
    'M143 258 C137 228 123 207 132 184 S118 145 122 118 S149 63 137 10 M132 184 Q114 179 96 164 M129 207 L135 207 M126 153 L126 148 M125 118 Q107 107 100 91 M128 98 L128 94 M139 65 L137 67',crown));
  const root = [
    [43,78,-57,44,.92,4], [50,63,19,51,.90,1],
    [81,75,-4,42,.84,2], [106,77,56,41,.87,0],
    [142,80,65,31,.82,3], [29,94,-90,32,.80,0]
  ].map((p,i)=>leaf('bg-r'+i,...p,i+11)).join('');
  panel.insertAdjacentHTML('beforeend', art('root','0 0 170 116',
    'M-7 120 C18 99 28 77 56 73 S116 101 165 75 M38 86 L43 78 M51 74 L50 63 M69 75 L81 75 M94 87 L106 77 M128 89 L142 80 M23 101 L29 94',root));
  const header = panel.querySelector('.masthead');
  if (header && !header.querySelector('.botanical-kicker')) {
    header.insertAdjacentHTML('afterbegin','<p class="botanical-kicker" aria-hidden="true">A LIVING AUDIOVISUAL CANVAS</p>');
  }
  panel.insertAdjacentHTML('beforeend','<p class="botanical-footer" aria-hidden="true">SOUND &nbsp;·&nbsp; PIGMENT &nbsp;·&nbsp; MOTION</p>');
})();
