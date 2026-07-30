import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three';

export const EARTH_RADIUS = 1;

export type EarthBundle = {
  root: Group;
  /** Rotates: earth + clouds + markers parent. */
  spin: Group;
  earth: Mesh;
  clouds: Mesh;
  atmosphere: Mesh;
  shadow: Mesh;
  dispose: () => void;
};

function createSoftShadowTexture(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new CanvasTexture(canvas);
  }

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 8, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(15, 23, 42, 0.35)');
  gradient.addColorStop(0.45, 'rgba(15, 23, 42, 0.12)');
  gradient.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createAtmosphereMaterial(dark: boolean): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: new Color(dark ? '#93c5fd' : '#bfdbfe'),
    transparent: true,
    opacity: dark ? 0.18 : 0.22,
    side: BackSide,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

/**
 * Photoreal Earth group matched to the reference look:
 * day map + clouds + blue fringe atmosphere + static soft ground shadow.
 */
export function createEarth(textures: { day: Texture; clouds: Texture }, dark: boolean): EarthBundle {
  const root = new Group();
  const spin = new Group();
  root.add(spin);

  const sphere = new SphereGeometry(EARTH_RADIUS, 64, 64);

  const earthMat = new MeshStandardMaterial({
    map: textures.day,
    roughness: 0.92,
    metalness: 0.05,
  });
  const earth = new Mesh(sphere, earthMat);
  spin.add(earth);

  const cloudGeo = new SphereGeometry(EARTH_RADIUS * 1.01, 64, 64);
  const cloudMat = new MeshStandardMaterial({
    map: textures.clouds,
    transparent: true,
    opacity: dark ? 0.35 : 0.45,
    depthWrite: false,
    roughness: 1,
    metalness: 0,
  });
  const clouds = new Mesh(cloudGeo, cloudMat);
  spin.add(clouds);

  const atmoGeo = new SphereGeometry(EARTH_RADIUS * 1.045, 48, 48);
  const atmosphere = new Mesh(atmoGeo, createAtmosphereMaterial(dark));
  root.add(atmosphere);

  const shadowTex = createSoftShadowTexture();
  const shadowGeo = new PlaneGeometry(2.4, 1.5);
  const shadow = new Mesh(
    shadowGeo,
    new MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: dark ? 0.55 : 0.7,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -EARTH_RADIUS - 0.08;
  root.add(shadow);

  // Africa-forward initial framing (matches reference photo)
  spin.rotation.y = -0.55;
  spin.rotation.x = 0.12;

  const dispose = () => {
    sphere.dispose();
    cloudGeo.dispose();
    atmoGeo.dispose();
    shadowGeo.dispose();
    earthMat.dispose();
    cloudMat.dispose();
    (atmosphere.material as MeshBasicMaterial).dispose();
    (shadow.material as MeshBasicMaterial).dispose();
    shadowTex.dispose();
  };

  return { root, spin, earth, clouds, atmosphere, shadow, dispose };
}

export function loadEarthTextures(): Promise<{ day: Texture; clouds: Texture }> {
  const loader = new TextureLoader();
  return Promise.all([
    loader.loadAsync('/globe/earth-day.jpg'),
    loader.loadAsync('/globe/earth-clouds.png'),
  ]).then(([day, clouds]) => {
    day.colorSpace = SRGBColorSpace;
    day.anisotropy = 4;
    clouds.anisotropy = 4;
    return { day, clouds };
  });
}

export function setEarthTheme(bundle: EarthBundle, dark: boolean) {
  const atmo = bundle.atmosphere.material as MeshBasicMaterial;
  atmo.color.set(dark ? '#93c5fd' : '#bfdbfe');
  atmo.opacity = dark ? 0.18 : 0.22;

  const cloud = bundle.clouds.material as MeshStandardMaterial;
  cloud.opacity = dark ? 0.35 : 0.45;

  const shadow = bundle.shadow.material as MeshBasicMaterial;
  shadow.opacity = dark ? 0.55 : 0.7;
}
