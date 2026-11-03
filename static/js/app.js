const graphContainer = document.getElementById('graph');
const tooltip = document.getElementById('tooltip');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const pathSource = document.getElementById('pathSource');
const pathTarget = document.getElementById('pathTarget');
const compareSource = document.getElementById('compareSource');
const compareTarget = document.getElementById('compareTarget');
const searchResults = document.getElementById('searchResults');
const suggestionsList = document.getElementById('suggestionsList');
const personDetails = document.getElementById('personDetails');
const mutualResults = document.getElementById('mutualResults');
const statusMessage = document.getElementById('statusMessage');

let cy;
let graphData = { nodes: [], edges: [] };
let selectedNodeId = null;
let selectedNeighbors = [];
let activePath = [];
let mutualFriends = [];
let comparisonTargetId = null;

const styleSheet = [
  {
    selector: 'node',
    style: {
      'background-color': '#60a5fa',
      'border-width': 2,
      'border-color': '#dbeafe',
      'label': 'data(username)',
      'font-size': '11px',
      'text-wrap': 'wrap',
      'text-max-width': '90px',
      'text-valign': 'center',
      'text-halign': 'center',
      'color': '#e2e8f0',
      'width': 'mapData(degree, 1, 9, 20, 42)',
      'height': 'mapData(degree, 1, 9, 20, 42)',
      'opacity': 0.95,
      'transition-property': 'background-color, border-color, width, height, opacity',
      'transition-duration': '0.15s'
    }
  },
  {
    selector: 'edge',
    style: {
      'curve-style': 'bezier',
      'line-color': '#7dd3fc',
      'width': 2,
      'opacity': 0.7,
      'target-arrow-shape': 'none'
    }
  },
  {
    selector: '.selected-node',
    style: {
      'background-color': '#fbbf24',
      'border-color': '#fef3c7',
      'border-width': 4,
      'overlay-color': '#fbbf24',
      'overlay-opacity': 0.18,
      'overlay-padding': 8,
      'width': 46,
      'height': 46,
      'opacity': 1
    }
  },
  {
    selector: '.friend-node',
    style: {
      'background-color': '#34d399',
      'border-color': '#d1fae5',
      'overlay-color': '#34d399',
      'overlay-opacity': 0.14,
      'overlay-padding': 6,
      'opacity': 1
    }
  },
  {
    selector: '.path-node',
    style: {
      'background-color': '#22c55e',
      'border-color': '#dcfce7',
      'overlay-color': '#22c55e',
      'overlay-opacity': 0.16,
      'overlay-padding': 7,
      'opacity': 1
    }
  },
  {
    selector: '.mutual-node',
    style: {
      'background-color': '#f472b6',
      'border-color': '#fbcfe8',
      'overlay-color': '#f472b6',
      'overlay-opacity': 0.22,
      'overlay-padding': 8,
      'opacity': 1
    }
  },
  {
    selector: '.mutual-edge',
    style: {
      'line-color': '#f472b6',
      'width': 6,
      'opacity': 1
    }
  },
  {
    selector: '.faded-node',
    style: {
      'opacity': 0.24,
      'text-opacity': 0.2
    }
  },
  {
    selector: '.friend-edge',
    style: {
      'line-color': '#4ade80',
      'width': 5,
      'opacity': 1
    }
  },
  {
    selector: '.path-edge',
    style: {
      'line-color': '#22c55e',
      'width': 6,
      'opacity': 1
    }
  },
  {
    selector: '.faded-edge',
    style: {
      'line-color': '#64748b',
      'opacity': 0.16,
      'width': 1.2
    }
  }
];

function updateStatus(message) {
  statusMessage.textContent = message;
}

function toSentenceCase(value) {
  return value ? value.toString().replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()) : '';
}

function renderProfile(details) {
  personDetails.innerHTML = '';

  if (!details) {
    personDetails.innerHTML = '<div class="empty-state">Select a person in the graph to view profile details.</div>';
    return;
  }

  const avatarText = details.display_name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();
  const mutualMarkup = details.mutual_friends && details.mutual_friends.length
    ? `<ul class="tag-list">${details.mutual_friends.map(friend => `<li>${toSentenceCase(friend)}</li>`).join('')}</ul>`
    : '<p class="empty-state">No mutual connections currently highlighted.</p>';

  personDetails.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">${avatarText}</div>
      <div>
        <h3 class="profile-name">${details.display_name}</h3>
        <p class="profile-handle">@${details.username}</p>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-box">
        <small>Connections</small>
        <strong>${details.degree}</strong>
      </div>
      <div class="meta-box">
        <small>Component</small>
        <strong>${details.connected_component_size}</strong>
      </div>
    </div>

    <div class="subsection">
      <h4>Direct friends</h4>
      <ul class="friend-list">
        ${details.friends.length ? details.friends.map(friend => `<li>${toSentenceCase(friend)}</li>`).join('') : '<li>No friends</li>'}
      </ul>
    </div>

    <div class="subsection">
      <h4>Mutual friends</h4>
      ${mutualMarkup}
    </div>
  `;
}

function renderMutualFriends(source, target, friends) {
  if (!friends.length) {
    mutualResults.innerHTML = `<p class="empty-state">No mutual friends between ${toSentenceCase(source)} and ${toSentenceCase(target)}.</p>`;
    return;
  }

  const namesByUsername = new Map(graphData.nodes.map(node => [node.username, node.displayName]));
  mutualResults.innerHTML = `
    <p class="empty-state">${friends.length} shared connection${friends.length === 1 ? '' : 's'} between ${toSentenceCase(source)} and ${toSentenceCase(target)}.</p>
    <ul class="friend-list">
      ${friends.map(friend => `
        <li>
          <span>${namesByUsername.get(friend) || toSentenceCase(friend)}</span>
          <button class="link-style" data-user="${friend}">View</button>
        </li>
      `).join('')}
    </ul>
  `;

  mutualResults.querySelectorAll('button[data-user]').forEach(button => {
    button.addEventListener('click', () => selectNode(button.dataset.user));
  });
}

function renderSearchResults(results) {
  if (!results || !results.length) {
    searchResults.innerHTML = '<li>No matches found.</li>';
    return;
  }

  searchResults.innerHTML = results.map(result => `
    <li>
      <span>${result.display_name}</span>
      <button class="link-style" data-user="${result.username}">View</button>
    </li>
  `).join('');

  searchResults.querySelectorAll('button[data-user]').forEach(button => {
    button.addEventListener('click', () => selectNode(button.dataset.user));
  });
}

function renderSuggestions(suggestions) {
  if (!suggestions || !suggestions.length) {
    suggestionsList.innerHTML = '<li>No suggestions available.</li>';
    return;
  }

  suggestionsList.innerHTML = suggestions.map(item => `
    <li>
      <span>${item.display_name}</span>
      <button class="link-style" data-user="${item.username}">Add</button>
    </li>
  `).join('');

  suggestionsList.querySelectorAll('button[data-user]').forEach(button => {
    button.addEventListener('click', () => selectNode(button.dataset.user));
  });
}

function resetVisualState() {
  selectedNodeId = null;
  selectedNeighbors = [];
  activePath = [];
  mutualFriends = [];
  comparisonTargetId = null;
  renderProfile(null);
  renderSuggestions([]);
  mutualResults.textContent = 'Choose two people to compare their mutual friends.';

  if (cy) {
    cy.elements().removeClass('selected-node friend-node path-node mutual-node mutual-edge faded-node friend-edge path-edge faded-edge');
    cy.nodes().forEach(node => node.removeClass('selected-node friend-node path-node mutual-node faded-node'));
    cy.edges().forEach(edge => edge.removeClass('friend-edge path-edge faded-edge'));
  }
  updateStatus('Map reset. Select a person to explore their network.');
}

function applyHighlighting() {
  if (!cy) {
    return;
  }

  const neighborSet = new Set(selectedNeighbors);
  const pathSet = new Set(activePath);
  const mutualSet = new Set(mutualFriends);

  cy.elements().removeClass('selected-node friend-node path-node mutual-node mutual-edge faded-node friend-edge path-edge faded-edge');

  if (!selectedNodeId) {
    cy.nodes().forEach(node => node.removeClass('faded-node'));
    cy.edges().forEach(edge => edge.removeClass('faded-edge'));
    return;
  }

  cy.nodes().forEach(node => {
    const nodeId = node.id();
    if (nodeId === selectedNodeId) {
      node.addClass('selected-node');
    } else if (mutualSet.has(nodeId)) {
      node.addClass('mutual-node');
    } else if (neighborSet.has(nodeId)) {
      node.addClass('friend-node');
    } else if (pathSet.has(nodeId)) {
      node.addClass('path-node');
    } else {
      node.addClass('faded-node');
    }
  });

  cy.edges().forEach(edge => {
    const source = edge.data('source');
    const target = edge.data('target');
    const isFriendEdge = (source === selectedNodeId && neighborSet.has(target)) || (target === selectedNodeId && neighborSet.has(source));
    const isPathEdge = pathSet.has(source) && pathSet.has(target);
    const isMutualEdge =
      (source === selectedNodeId && mutualSet.has(target)) ||
      (target === selectedNodeId && mutualSet.has(source)) ||
      (source === comparisonTargetId && mutualSet.has(target)) ||
      (target === comparisonTargetId && mutualSet.has(source));

    if (isPathEdge) {
      edge.addClass('path-edge');
    } else if (isMutualEdge) {
      edge.addClass('mutual-edge');
    } else if (isFriendEdge || isMutualEdge) {
      edge.addClass('friend-edge');
    } else {
      edge.addClass('faded-edge');
    }
  });
}

function selectNode(username) {
  if (!username || !cy) {
    return;
  }

  selectedNodeId = username;
  activePath = [];
  mutualFriends = [];
  comparisonTargetId = null;
  compareSource.value = username;
  mutualResults.textContent = 'Choose two people to compare their mutual friends.';

  cy.center(cy.getElementById(username));

  fetch(`/api/person/${encodeURIComponent(username)}`)
    .then(response => response.json())
    .then(details => {
      selectedNeighbors = details.friends || [];
      renderProfile(details);
      fetch(`/api/suggestions?username=${encodeURIComponent(username)}`)
        .then(res => res.json())
        .then(renderSuggestions)
        .catch(() => renderSuggestions([]));
      applyHighlighting();
      updateStatus(`Selected ${toSentenceCase(username)}.`);
    })
    .catch(() => {
      updateStatus('Could not load profile details.');
    });
}

function setupTooltip() {
  cy.on('mouseover', 'node', event => {
    const node = event.target;
    const data = node.data();
    const degree = data.degree || 0;
    const componentSize = data.connectedComponentSize || 1;
    tooltip.innerHTML = `
      <h4>${toSentenceCase(data.displayName || data.username)}</h4>
      <p>@${data.username}</p>
      <p>Connections: ${degree}</p>
      <p>Component: ${componentSize}</p>
    `;
    tooltip.classList.remove('hidden');
  });

  cy.on('mouseout', 'node', () => {
    tooltip.classList.add('hidden');
  });

  cy.on('mousemove', 'node', event => {
    const position = event.originalEvent || event;
    tooltip.style.left = `${position.clientX + 18}px`;
    tooltip.style.top = `${position.clientY + 18}px`;
  });
}

function buildGraphView(nodes, edges) {
  const elements = {
    nodes: nodes.map(node => ({
      data: {
        id: node.id,
        username: node.username,
        displayName: node.displayName,
        degree: node.degree,
        connectedComponentSize: node.connectedComponentSize
      }
    })),
    edges: edges.map(edge => ({
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target
      }
    }))
  };

  cy = cytoscape({
    container: graphContainer,
    elements,
    style: styleSheet,
    layout: {
      name: 'cose',
      animate: false,
      randomize: false,
      fit: true,
      padding: 28,
      nodeRepulsion: 14000,
      idealEdgeLength: 110,
      edgeElasticity: 175,
      gravity: 0.18
    },
    wheelSensitivity: 0.3,
    maxZoom: 2.5,
    minZoom: 0.15,
    selectionType: 'single'
  });

  setupTooltip();

  cy.on('tap', 'node', event => {
    const id = event.target.id();
    selectNode(id);
  });

  cy.on('tap', event => {
    if (event.target === cy) {
      resetVisualState();
    }
  });

  cy.fit();
}

function populateSelectors() {
  const usernames = [...graphData.nodes].sort((a, b) => a.username.localeCompare(b.username));

  const buildOptions = (select, selectedValue) => {
    select.innerHTML = usernames.map(node => `
      <option value="${node.username}" ${node.username === selectedValue ? 'selected' : ''}>${toSentenceCase(node.username)}</option>
    `).join('');
  };

  buildOptions(pathSource, usernames[0]?.username || '');
  buildOptions(pathTarget, usernames[1]?.username || usernames[0]?.username || '');
  buildOptions(compareSource, usernames[0]?.username || '');
  buildOptions(compareTarget, usernames[1]?.username || usernames[0]?.username || '');
}

function fetchGraph() {
  fetch('/api/graph')
    .then(response => response.json())
    .then(data => {
      graphData = data;
      buildGraphView(data.nodes, data.edges);
      populateSelectors();
      updateStatus(`${data.nodes.length} people loaded across ${data.edges.length} relationships.`);
      renderSearchResults([]);
    })
    .catch(() => {
      updateStatus('Graph data failed to load.');
    });
}

searchBtn.addEventListener('click', () => {
  const query = searchInput.value.trim();
  if (!query) {
    renderSearchResults([]);
    return;
  }

  fetch(`/api/search?query=${encodeURIComponent(query)}`)
    .then(response => response.json())
    .then(renderSearchResults)
    .catch(() => renderSearchResults([]));
});

searchInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    searchBtn.click();
  }
});

document.getElementById('findPathBtn').addEventListener('click', () => {
  const source = pathSource.value;
  const target = pathTarget.value;

  if (!source || !target) {
    updateStatus('Choose both people before computing the shortest path.');
    return;
  }

  fetch(`/api/path?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}`)
    .then(response => response.json())
    .then(data => {
      if (!data.path || !data.path.length) {
        activePath = [];
        applyHighlighting();
        updateStatus(`No connection path exists between ${toSentenceCase(source)} and ${toSentenceCase(target)}.`);
        return;
      }

      activePath = data.path;
      updateStatus(`Shortest path between ${toSentenceCase(source)} and ${toSentenceCase(target)} is ${data.distance} steps.`);
      applyHighlighting();
    });
});

document.getElementById('mutualBtn').addEventListener('click', () => {
  const source = compareSource.value;
  const target = compareTarget.value;

  if (!source || !target) {
    updateStatus('Select a person and a comparison target to reveal mutual friends.');
    return;
  }

  fetch(`/api/person/${encodeURIComponent(source)}?with=${encodeURIComponent(target)}`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Could not load mutual friends.');
      }
      return response.json();
    })
    .then(data => {
      mutualFriends = data.mutual_friends || [];
      selectedNodeId = source;
      selectedNeighbors = data.friends || [];
      activePath = [];
      comparisonTargetId = target;
      renderProfile(data);
      renderMutualFriends(source, target, mutualFriends);
      applyHighlighting();
      updateStatus(`${mutualFriends.length} mutual friends found between ${toSentenceCase(source)} and ${toSentenceCase(target)}.`);
    })
    .catch(error => {
      updateStatus(error.message);
    });
});

document.getElementById('fitBtn').addEventListener('click', () => {
  if (cy) {
    cy.fit(cy.elements(), 32);
  }
});

document.getElementById('resetBtn').addEventListener('click', () => {
  resetVisualState();
  if (cy) {
    cy.fit(cy.elements(), 32);
  }
});

fetchGraph();
