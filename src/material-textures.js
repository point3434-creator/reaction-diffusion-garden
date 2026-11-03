// Original Shadertoy texture bytes are embedded by tools/splice.py for offline use.
// Complete placeholders keep every material drawable while the images decode.
function loadMaterialTextures(gl, shellUrls, amberUrl) {
  var surfaces = [gl.createTexture(), gl.createTexture()], units = [gl.TEXTURE3, gl.TEXTURE5];
  var environment = gl.createTexture();
  surfaces.forEach(function (texture, i) {
    gl.activeTexture(units[i]);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  });
  gl.activeTexture(gl.TEXTURE4);
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, environment);
  for (var face = 0; face < 6; face++) {
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([80, 80, 80, 255]));
  }
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
  gl.activeTexture(gl.TEXTURE0);
  return Promise.all(shellUrls.concat(amberUrl).map(function (url) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () { resolve(image); };
      image.onerror = function () { reject(new Error('Material texture could not decode')); };
      image.src = url;
    });
  })).then(function (images) {
    // A context restoration creates new textures; never upload into stale handles.
    if (gl.isContextLost() || !gl.isTexture(environment) || surfaces.some(function (texture) { return !gl.isTexture(texture); })) return false;
    surfaces.forEach(function (texture, i) {
      gl.activeTexture(units[i]);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, images[i === 0 ? 0 : 7]);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    });
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, environment);
    for (var face = 0; face < 6; face++) {
      gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, images[face + 1]);
    }
    gl.activeTexture(gl.TEXTURE0);
    return true;
  }).catch(function (error) {
    console.warn(error.message);
    return false;
  });
}
