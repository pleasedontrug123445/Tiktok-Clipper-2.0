// script.js

// For IPC calls
const { ipcRenderer } = require('electron');

const fazeButton = document.getElementById('fazeButton');
const streamerListDiv = document.getElementById('streamer-list');
const clipsContainer = document.getElementById('clips-container');

// Toggle the streamer buttons
fazeButton.addEventListener('click', () => {
  if (streamerListDiv.style.display === 'none') {
    streamerListDiv.style.display = 'block';
  } else {
    streamerListDiv.style.display = 'none';
  }
});

// Called when a streamer button is clicked
async function selectCreator(streamerName) {
  clipsContainer.innerHTML = `<p>Loading clips for ${streamerName}...</p>`;

  // Call main process to get the streamer's clips
  const clips = await ipcRenderer.invoke('get-clips', streamerName);

  if (!clips || clips.length === 0) {
    clipsContainer.innerHTML = `<p>No matching clips found for "${streamerName}".</p>`;
    return;
  }

  // Build HTML for each clip
  let html = `<h2>Clips for ${streamerName}</h2>`;
  html += `<ul>`;
  clips.forEach(clip => {
    html += `
      <li>
        <strong>Title:</strong> ${clip.title}<br>
        <strong>Views:</strong> ${clip.views}<br>
        <strong>Created:</strong> ${new Date(clip.creationDate).toLocaleString()}<br>
        <a href="${clip.url}" target="_blank">Open Clip</a>
      </li>
      <hr>
    `;
  });
  html += `</ul>`;

  clipsContainer.innerHTML = html;
}
