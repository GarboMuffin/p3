<script>
  import {_} from '../locales/';
  import {slide, fade} from 'svelte/transition';
  import Section from './Section.svelte';
  import Button from './Button.svelte';
  import ComplexMessage from './ComplexMessage.svelte';
  import Packager from './packager';
  import writablePersistentStore from './persistent-store';
  import {error, progress} from './stores';
  import Preview from './preview';
  import deepClone from './lib/deep-clone';
  import assetCache from './cache';
  import analytics from './analytics';

  export let projectData;

  // JSON can't easily parse Infinity, so we'll just store large numbers instead
  const ALMOST_INFINITY = 9999999999;

  const cloudVariables = Object.values(projectData.project.analysis.stageVariables)
    .filter(i => i.isCloud)
    .map(i => i.name);
  const canUseCloudVariableServer = !!projectData.projectId;

  const defaultOptions = Packager.DEFAULT_OPTIONS();
  defaultOptions.projectId = projectData.projectId;
  if (!canUseCloudVariableServer) {
    defaultOptions.cloudVariables.mode = 'local';
  }
  for (const variable of cloudVariables) {
    defaultOptions.cloudVariables.custom[variable] = canUseCloudVariableServer ? 'ws' : 'local';
  }
  defaultOptions.app.packageName = Packager.getDefaultPackageNameFromTitle(projectData.title);
  defaultOptions.app.windowTitle = Packager.getWindowTitleFromProjectTitle(projectData.title);
  const options = writablePersistentStore(`PackagerOptions.${projectData.uniqueId}`, defaultOptions);

  let result = null;
  let url = null;
  let previewer = null;
  let iconFiles = null;
  let customExtensions = $options.extensions.map(i => i.url).join('\n');
  $: $options.app.icon = iconFiles ? iconFiles[0] : null;
  $: $options.extensions = customExtensions.split('\n').filter(i => i).map(i => ({url: i}));
  $: if (previewer) {
    previewer.setProgress($progress.progress, $progress.text);
  }

  const handleLargeAssetFetchProgress = ({detail}) => {
    if (detail.asset.startsWith('nwjs-')) {
      $progress.text = $_('progress.loadingNwjs');
    } else if (detail.asset.startsWith('electron-')) {
      $progress.text = 'Loading electron';
    }
    $progress.progress = detail.progress;
  };

  const handleZipProgress = ({detail}) => {
    $progress.text = $_('progress.compressingProject');
    $progress.progress = detail.progress;
  };

  const downloadURL = (filename, url) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const runPackager = async (options) => {
    try {
      const packager = new Packager();
      packager.options = options;
      packager.project = projectData.project;

      $progress.visible = true;
      $progress.text = $_('progress.loadingScripts');

      if (url) {
        URL.revokeObjectURL(url);
      }
      result = null;
      url = null;

      packager.addEventListener('large-asset-fetch', handleLargeAssetFetchProgress);
      packager.addEventListener('zip-progress', handleZipProgress);

      result = await packager.package();
      url = URL.createObjectURL(result.blob);
    } catch (e) {
      $error = e;
    }
    progress.reset();
  };

  const pack = async () => {
    await runPackager(deepClone($options));
    if (result) {
      downloadURL(result.filename, url);
    }
    analytics.sendEvent('Package');
  };

  const preview = async () => {
    previewer = new Preview();
    const optionsClone = deepClone($options);
    optionsClone.target = 'html';
    await runPackager(optionsClone);
    if (result) {
      previewer.setContent(result.blob);
    } else {
      previewer.close();
    }
    previewer = null;
    analytics.sendEvent('Preview');
  };

  const reset = async () => {
    if (confirm($_('options.confirmReload'))) {
      try {
        await assetCache.resetAll();
      } catch (e) {
        console.warn(e);
      }
      localStorage.clear();
      location.reload();
    }
  };
</script>

<style>
  label {
    display: block;
    margin-bottom: 4px;
  }
  input[type=number] {
    width: 60px;
  }
  input[type=text] {
    width: 150px;
  }
  textarea {
    display: block;
    height: 100px;
    width: 100%;
    box-sizing: border-box;
  }
  textarea.large {
    height: 200px;
  }
  textarea.nowrap {
    white-space: nowrap;
  }
  .environment-section {
    margin-bottom: 12px;
  }
  .downloads {
    text-align: center;
  }
</style>

<Section accent="#FFAB19">
  <h2>{$_('options.runtimeOptions')}</h2>

  <!-- TODO: this is not ideal, the help should be in here -->
  <!-- especially as not all of these options are actually in advanced settings on the main site -->
  <p>
    <ComplexMessage
      message={$_('options.moreHelp')}
      values={{
        turbowarp: {
          text: 'TurboWarp',
          href: 'https://turbowarp.org/'
        }
      }}
    />
  </p>

  <label>
    <input type="checkbox" bind:checked={$options.turbo}>
    {$_('options.turbo')}
  </label>
  <label>
    {$_('options.framerate')}
    <input type="number" min="0" max="240" bind:value={$options.framerate}>
  </label>
  <label>
    <input type="checkbox" bind:checked={$options.interpolation}>
    {$_('options.interpolation')}
  </label>
  <label>
    <input type="checkbox" bind:checked={$options.highQualityPen}>
    {$_('options.highQualityPen')}
  </label>
  <label>
    <input type="checkbox" checked={$options.maxClones === ALMOST_INFINITY} on:change={(e) => {
      $options.maxClones = e.target.checked ? ALMOST_INFINITY : 300;
    }}>
    {$_('options.infiniteClones')}
  </label>
  <label>
    <input type="checkbox" checked={!$options.fencing} on:change={(e) => {
      $options.fencing = !e.target.checked;
    }}>
    {$_('options.removeFencing')}
  </label>
  <label>
    <input type="checkbox" checked={!$options.miscLimits} on:change={(e) => {
      $options.miscLimits = !e.target.checked;
    }}>
    {$_('options.removeMiscLimits')}
  </label>
  <label>
    {$_('options.stageSize')}
    <input type="number" min="0" max="4096" step="1" bind:value={$options.stageWidth}>
    &times;
    <input type="number" min="0" max="4096" step="1" bind:value={$options.stageHeight}>
  </label>
  <label>
    {$_('options.username')}
    <input type="text" bind:value={$options.username}>
  </label>
  <label>
    <input type="checkbox" bind:checked={$options.autoplay}>
    {$_('options.autoplay')}
  </label>
</Section>

<Section accent="#9966FF">
  <h2>{$_('options.playerOptions')}</h2>

  <label>
    {$_('options.pageTitle')}
    <input type="text" bind:value={$options.app.windowTitle}>
  </label>
  <label>
    {$_('options.loadingScreenText')}
    <input type="text" bind:value={$options.loadingScreen.text} placeholder={$_('options.loadingScreenTextPlaceholder')}>
  </label>
  <label>
    {$_('options.icon')}
    <input type="file" bind:files={iconFiles} accept=".png,.jpg,.jpeg,.bmp,.svg">
  </label>

  <h3>{$_('options.controls')}</h3>
  <label>
    <input type="checkbox" bind:checked={$options.controls.greenFlag.enabled}>
    {$_('options.showFlag')}
  </label>
  <label>
    <input type="checkbox" bind:checked={$options.controls.stopAll.enabled}>
    {$_('options.showStop')}
  </label>
  <label>
    <input type="checkbox" bind:checked={$options.controls.fullscreen.enabled}>
    {$_('options.showFullscreen')}
  </label>
  <p>{$_('options.controlsHelp')}</p>

  <h3>{$_('options.colors')}</h3>
  <label>
    <input type="color" bind:value={$options.appearance.background}>
    {$_('options.backgroundColor')}
  </label>
  <label>
    <input type="color" bind:value={$options.appearance.foreground}>
    {$_('options.foregroundColor')}
  </label>
  <label>
    <input type="color" bind:value={$options.appearance.accent}>
    {$_('options.accentColor')}
  </label>

  <h3>{$_('options.addons')}</h3>
  <label>
    <input type="checkbox" bind:checked={$options.chunks.gamepad}>
    {$_('options.gamepadSupport')}
  </label>
</Section>

{#if cloudVariables.length > 0}
  <Section accent="#FF8C1A">
    <h2>{$_('options.cloudVariables')}</h2>
    <label>
      {$_('options.mode')}
      <select bind:value={$options.cloudVariables.mode}>
        {#if canUseCloudVariableServer}
          <option value="ws">{$_('options.cloudVariables-ws')}</option>
        {:else}
          <option disabled>{$_('options.cloudVariables-ws-unavailable')}</option>
        {/if}
        <option value="local">{$_('options.cloudVariables-local')}</option>
        <option value="">{$_('options.cloudVariables-ignore')}</option>
        <option value="custom">{$_('options.cloudVariables-custom')}</option>
      </select>
    </label>
    {#if $options.cloudVariables.mode === "custom"}
      <div transition:slide|local>
        {#each cloudVariables as variable}
          <label>
            <select bind:value={$options.cloudVariables.custom[variable]}>
              {#if canUseCloudVariableServer}
                <option value="ws">{$_('options.cloudVariables-ws')}</option>
              {:else}
                <option disabled>{$_('options.cloudVariables-ws-unavailable')}</option>
              {/if}
              <option value="local">{$_('options.cloudVariables-local')}</option>
              <option value="">{$_('options.cloudVariables-ignore')}</option>
            </select>
            {variable}
          </label>
        {/each}
      </div>
    {/if}
    <p>{$_('options.cloudVariables-ws-help')}</p>
    <p>{$_('options.cloudVariables-local-help')}</p>
    <p>{$_('options.cloudVariables-ignore-help')}</p>
    <p>{$_('options.cloudVariables-custom-help')}</p>
  </Section>
{/if}

<Section accent="#FF6680">
  <h2>{$_('options.advancedOptions')}</h2>
  <details>
    <summary>{$_('options.advancedSummary')}</summary>
    <label>
      <input type="checkbox" bind:checked={$options.compiler.enabled}>
      {$_('options.enableCompiler')}
    </label>
    <label>
      <input type="checkbox" bind:checked={$options.compiler.warpTimer}>
      {$_('options.warpTimer')}
    </label>
    <label>
      {$_('options.customExtensions')}
      <textarea bind:value={customExtensions} class="nowrap"></textarea>
    </label>
    <label>
      {$_('options.customJS')}
      <textarea bind:value={$options.custom.js} class="large"></textarea>
    </label>
  </details>
</Section>

<Section accent="#0FBD8C">
  <h2>{$_('options.environment')}</h2>
  <div class="environment-section">
    <label>
      <input type="radio" bind:group={$options.target} value="html">
      {$_('options.html')}
    </label>
  </div>
  <div class="environment-section">
    <label>
      <input type="radio" bind:group={$options.target} value="zip">
      {$_('options.zip')}
    </label>
    <label>
      <input type="radio" bind:group={$options.target} value="zip-one-asset">
      {$_('options.zip-one-asset')}
    </label>
  </div>
  <div class="environment-section">
    <label>
      <input type="radio" bind:group={$options.target} value="nwjs-win32">
      {$_('options.nwjs-win32')}
    </label>
    <label>
      <input type="radio" bind:group={$options.target} value="nwjs-win64">
      {$_('options.nwjs-win64')}
    </label>
    <label>
      <input type="radio" bind:group={$options.target} value="nwjs-mac">
      {$_('options.nwjs-mac')}
    </label>
    <label>
      <input type="radio" bind:group={$options.target} value="nwjs-linux-x64">
      {$_('options.nwjs-linux64')}
    </label>
  </div>
  <div class="environment-section">
    <label>
      <input type="radio" bind:group={$options.target} value="electron-win32">
      <!-- TODO: translate -->
      Electron Windows application (32-bit or 64-bit)
    </label>
    <label>
      <input type="radio" bind:group={$options.target} value="electron-linux64">
      <!-- TODO: translate -->
      Electron Linux application (64-bit only)
    </label>
  </div>
</Section>

{#if $options.target.startsWith('nwjs-') || $options.target.startsWith('electron-')}
  <div in:fade|local>
    <Section accent="#FF661A">
      <!-- TODO: translate -->
      <h2>Application Settings</h2>
      <label>
        {$_('options.packageName')}
        <input type="text" bind:value={$options.app.packageName}>
      </label>

      {#if $options.target.includes('win')}
        <div>
          <h2>{$_('nwjs.furtherStepsWin')}</h2>
          <p>To change the executable icon or create an installer program, download and run <a href="https://github.com/TurboWarp/packager-extras/releases">TurboWarp Packager Extras</a> and select the output of this website.</p>
        </div>
      {:else if $options.target.includes('mac')}
        <h2>{$_('nwjs.furtherStepsMac')}</h2>
        <p>macOS support is still experimental.</p>
        <p>Due to Apple policy, packaging for their platforms is rather troublesome. You either have to:</p>
        <ul>
          <li>Pay Apple $100/year for a developer account to sign and notarize the app (we do not have a tutorial for this as we can't afford that and don't want to support such practices), or</li>
          <li>Instruct users to ignore Gatekeeper by opening Finder > Navigating to the application > Right click > Open > Open again</li>
        </ul>
        {#if $options.target.includes('nwjs')}
          <p>NW.js runs natively on Intel Macs but will use Rosetta on Apple silicon Macs.</p>
          <p>For further help and steps, see <a href="https://docs.nwjs.io/en/latest/For%20Users/Package%20and%20Distribute/#mac-os-x">NW.js Documentation</a>.</p>
        {/if}
      {:else if $options.target.includes('linux')}
        <h2>{$_('nwjs.furtherStepsLinux')}</h2>
        <p>Linux support is still experimental.</p>
        {#if $options.target.includes('nwjs')}
          <p>For further help and steps, see <a href="https://docs.nwjs.io/en/latest/For%20Users/Package%20and%20Distribute/#linux">NW.js Documentation</a>.</p>
        {/if}
      {/if}
    </Section>
  </div>
{/if}

<Section>
  <Button on:click={pack} disabled={$progress.visible}>{$_('options.package')}</Button>
  <Button on:click={preview} disabled={$progress.visible} secondary>{$_('options.preview')}</Button>
  <Button on:click={reset} danger>{$_('options.reset')}</Button>
</Section>

{#if result && url}
  <Section>
    <div class="downloads">
      <a href={url} download={result.filename}>
        {$_('options.download')
          .replace('{filename}', result.filename)
          .replace('{size}', (result.blob.size / 1000 / 1000).toFixed(2))}
    </div>
  </Section>
{:else if !$progress.visible}
  <Section caption>
    <p>{$_('options.downloadsWillAppearHere')}</p>
  </Section>
{/if}
