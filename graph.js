

// Map Elements to Goals in force-directed graph

const discardNoneGoals = false;

var graph;
var simulation;

// dimensions
var dim = {
  width: document.documentElement.clientWidth,
  height: document.documentElement.clientHeight,
  margin: 20,
  nodeRadius: 4.5,
  goalRadius: 40
};
dim.midwidth = dim.width / 2;
dim.midheight = dim.height / 2;

// goal number => name mappings
// ideally would be externalized
var gAbbr = ['Drugs', 'HTC', 'Linkage', 'Retention',
             'VMMC', 'PMTCT', 'Resource', 'Perf Mgt',
             'Efficiency'];

// import library for color blending
var Color = net.brehaut.Color;

    
var boundary = { x: [-dim.width, 2 * dim.width],
                 y: [-dim.height, 2 * dim.height]
               };

  // Color scheme dervied from Google practices according to
  // http://bl.ocks.org/aaizemberg/78bd3dade9593896a59d
  // extended with a few other choices
    
  const colores_g = [ "#3366cc", "#dc3912", "#ff9900", "#109618",
                      "#990099", "#0099c6", "#dd4477", "#66aa00",
                      "#b82e2e", "#316395", "#994499", "#22aa99",
                      "#aaaa11", "#6633cc", "#e67300", "#8b0707",
                      "#651067", "#329262", "#5574a6", "#3b3eac",
                      // following added
                      "#98df8a", "#17becf", "#8ca252", "#7f7f7f"
                    ];
  
// scale maps goal numbers to color palette
var goalColor = d3.scaleOrdinal()
                  .range(colores_g);
// scale goal label font size
var maxGoalChars = _.max(gAbbr.map(a => a.length));
var goalFontSize = d3.scaleLinear()
                     .domain([1, maxGoalChars])
                     .range([27, 13])


/**
 * Given a list of colors, mix them in equal proportions.
 */
function blendedColors(clist) {
  var proportion = 1 / clist.length;
  var c = Color(clist[0]);
  clist.slice(1).forEach(oc => c = c.blend(Color(oc), proportion));
  return c.toCSS();
}

/**
 * Custom split of goal specification into
 * constituent parts.
 */
function goalsSplit(g) {
  g = g.trim();
  if (g === null) return  [ 'null' ];
  if (g === undefined) return  [ 'undefined' ];
  if (g.match(/^(unk|na|null|none)$/i)) return [g];
  return g.split('')
          .map(x => (x === '') || (x === ' ') ? 'blank' : x);
}

/**
 * Identify which goal ids are weaklings.
 */
function weakGoal(gid) {
  if (gid === 'gnone') return true;
  if (gid === 'g?')    return true;
  if (gid === 'gNA')   return true;
  return false;
}

const elementsUrl = 'elementsClean.csv';

queue()
  .defer(d3.csv, elementsUrl)
  .await(loadData);

function loadData(err, elementData) {
    if (err) throw error;
    console.log('data loaded');
    
    if (discardNoneGoals) {
      elementData = elementData.filter(d => d.Goal != 'none');
    }
  
    // construct nodes and links structures
    var goals = {};
    var nodes = {};
    var links = [];
    var nodeIndex = 0;
    var linkIndex = 0;

    function addLink(sid, tid, value, lid) {
      var newLink = { source: sid,
                      target: tid,
                      value: value || 1,
                      id: lid || ('l' + linkIndex++) };         
      links.push(newLink);
    }
    
    elementData.forEach((node, i) => {
      node.id = 'e' + node.ElementCode;
      node.index = nodeIndex++;
      node.type = 'element';
      node.r = dim.nodeRadius;
      
      // discover goal nodes
      var nodeGoalIds = [];
      goalsSplit(node.Goal).forEach(g => {
        var gid = 'g' + g;
        nodeGoalIds.push(gid);
        goals[gid] = true;
        addLink(node.id, gid, 1.0,  'l' + linkIndex++);
      });

      nodes[node.id] = node;
      node.goals = nodeGoalIds.sort();
    });
  
    // add goal nodes to graph
    var goalIds = _.keys(goals).sort();
    goalColor.domain(goalIds);
    goalIds.forEach(gid => {
      var goalNode = { id: gid,
                       index: nodeIndex++,
                       type: 'goal',
                       x: _.random(dim.width),  // may be replaced if stronger
                       y: _.random(dim.height), // goal placement algorith used
                       r: dim.goalRadius,
                       goals: []
                      };
      nodes[gid] = goalNode;      
    });
    
    // add nodes and links to overall graph structure
    graph = { nodes: _.keys(nodes).map(nid => nodes[nid]),
              links: links,
              goals: goalIds,
            };
    
    var goalNodes = graph.nodes.filter(n => n.type === 'goal')
                               .sort((a,b) => a.id > b.id);
    graph.goalNodes = goalNodes;
            
    // stronger node placement around goal
    
    // first compute children per goal
    var goalChildren = {};
    graph.goals.forEach(gid => {
      var children = graph.nodes.filter(n => (n.type !== 'goal')
                                          && (n.goals.indexOf(gid) > -1));
      goalChildren[gid] = children;
    });
    graph.goalChildren = goalChildren;
    
    var goalNChildren = _.map(goalChildren, (v, k) => v.length);

    // stronger goal placement (around oval)
    var ovalPoints = weightedOvalXY(goalNChildren, dim.midwidth, dim.midheight,
                            dim.height * 0.275, dim.width / dim.height, 1);
    const goalVicinity = 40;
    goalNodes.forEach((gn,i) => {
      gn.fx = ovalPoints[i][0];
      gn.fy = ovalPoints[i][1];
      
      // now place children around it for faster layout
      _.each(graph.goalChildren, (gchildren, gid) => {
        gchildren.forEach(n => {
          n.x = _.random(gn.fx - goalVicinity, gn.fx + goalVicinity);
          n.y = _.random(gn.fy - goalVicinity, gn.fy + goalVicinity);
        });
      });
    });
    
    // color the nodes according to goal affiliation
    graph.nodes.forEach(n => {
      if (n.type === 'goal') {
        n.color = 'black';
      } else {
        if (n.goals.length === 1) {
          // single goal, color to its goal
          n.color = goalColor(n.goals[0]);
        } else {
          // multiple goals, blend the colors
          var gcolors = n.goals.map(gid => goalColor(gid));
          n.color = blendedColors(gcolors);
        }
      }
    });
    
    // show our work
    console.log('graph:', graph);
    console.log('nodes:', graph.nodes.length,
                'links:', graph.links.length);
    
    if (false) {
      // create JSON for copy/paste
      var payload = '\n' + JSON.stringify(graph, null, '  ') + '\n';
      d3.select('body').append('pre').text(payload);
    }
    
    // do fun stuff
    drawGraph(graph);
}
  
// global drawing state
var svg;
var links;
var nodes;
var labels;

/**
 * Draw basic force layout graph.
 */
function drawGraph(g) {
  
  var zoom = d3.zoom()
      .scaleExtent([0.1, 2])
      .translateExtent([[-100, -100], [dim.width + 90, dim.height + 100]])
      .on("zoom", zoomed);
    
  svg = d3.select('#graph')
          .append('svg')
          .attr('width', dim.width)
          .attr('height', dim.height)
          .attr('preserveAspectRatio', 'xMidYMid')
          .call(zoom);
              
  
  function zoomed() {
    // svgg.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
    svgg.attr("transform", d3.event.transform);
  }

  // add some layers
  var svgg = svg.append('g');
  var linkg = svgg.append('g').attr('class', 'links');
  var nodeg = svgg.append('g').attr('class', 'nodes');
  
  // add links
  // styles set by CSS, position by animation (ticker)
  links = linkg.selectAll('line')
               .data(g.links)
               .enter()
                 .append('line')
                 .attr('class', 'link');
                 
  // add nodes
  nodes = nodeg.selectAll('.node')
             .data(g.nodes)
             .enter()
               .append('circle')
               .attr('class', d => `node${d.index} ${d.type}Node`)
               .style('fill', d => d.color)
               .style('stroke', d => d.type === 'goal' ?  
                                    goalColor(d.id) : null)
               .attr('cx', d => d.x)
               .attr('cy', d => d.y)
               .attr('r', d => d.r)
               .call(d3.drag()
                 .on("start", dragstarted)
                 .on("drag",  dragged)
                 .on("end",   dragended));
         
  // construct labels for goal nodes
  labels = [];
  graph.goalNodes.forEach(n => {
    var labelText = n.id.match(/^g\d+$/)
          ? gAbbr[parseInt(n.id.slice(1))-1] : n.id.slice(1);

    var t = svgg.append('text')
                .attr('class', 'label')
                .attr('x', n.x)
                .attr('y', n.y + 4)
                .style('font-size', goalFontSize(labelText.length))
                .text(labelText);
    labels.push({ text: t, node: n });
  });
    
  simulation = d3.forceSimulation()
      .force("link", d3.forceLink()
                       .id(d => d.id)
                       .distance(d => d.value * 0.4)
                      )
      .force("charge", d3.forceManyBody())
      .force("center", d3.forceCenter(dim.midwidth, dim.midheight));

  simulation.nodes(g.nodes).on("tick", ticker);
  simulation.force("link").links(g.links);
  simulation.alpha(2.3);  // vigorous shaking
  simulation.restart();
  
  // in a while, move the goal node
  // could also be done as function of simulation convergence
  // rather than time
  setTimeout(function() { migrateGoals(simulation); },
           12 * 1000);
}

var migratedCount = 0;
const maxMigratedCount = 1;

function migrateGoals(simulation) {
  console.log('migrate goal nodes');
  if (++migratedCount > maxMigratedCount) {
    console.log('can only migrate so many times; done', maxMigratedCount);
    return;
  }
  graph.goals.forEach(gid => {
    var goalNode = graph.nodes.filter(n => n.id === gid)[0];
    var children = graph.nodes.filter(n => (n.type !== 'goal')
                                        && (n.goals[0] === gid));
    var nChildren = children.length;
    var midX = children.map(n => n.x)
                       .reduce((a,b) => a+b, 0) / nChildren;
    var midY = children.map(n => n.y)
                       .reduce((a,b) => a+b, 0) / nChildren;
    goalNode.fx = midX;
    goalNode.fy = midY;
  });
  simulation.alpha(1.2);
  simulation.restart();
  
  // again in a while, re-situate the goal nodes
  setTimeout(function() { migrateGoals(simulation); },
           10 * 1000);
}

function weightedOvalXY(weights, cx=0, cy=0, r=100, sx=1, sy=1, degStart=0) {
  var tau = Math.PI * 2;
  var adjWeights = weights.map(w => Math.pow(w, 0.3));
  var sum = adjWeights.reduce((a,b) => a+b, 0);
  var points = [];
  var theta = degStart;
  for (i=0; i<adjWeights.length; i++) {
    var point = [ cx + Math.cos(theta) * r * sx,
                  cy + Math.sin(theta) * r * sy,
                ];
    points.push(point);
    theta += adjWeights[i] / sum * tau;
  }
  return points;
}


var tickCount = 0;

/**
 * Run every simulation tick.
 */
function ticker() {
  tickCount++;
  
  links.attr('x1', d => d.source.x)
       .attr('y1', d => d.source.y)
       .attr('x2', d => d.target.x)
       .attr('y2', d => d.target.y);

  if (tickCount === 40) {
    // once roughed in, add a collision force
    simulation.force("collide", d3.forceCollide(d =>
                   d.type === 'goal' ? 1.25 * d.r : d.r));
  }
  
  // move nodes
  if (boundary) {
    var [minx, maxx] = boundary.x;
    var [miny, maxy] = boundary.y;
    nodes.attr('cx', d => {
                if (d.x < minx) {
                  d.x = minx; d.vx = 0;
                } else if (d.x > maxx) {
                  d.x = maxx; d.vx = 0;
                }
                return d.x;
          })
         .attr('cy', d => {
               if (d.y < miny) {
                  d.y = miny; d.vy = 0;
                } else if (d.y > maxy) {
                  d.y = maxy; d.vy = 0;
                }
                return d.y;
         });
  }
  else {
      nodes.attr('cx', d => d.x)
           .attr('cy', d => d.y);
  }
       
  // once roughed in, adjust viewBox dynamically to
  // follow animation
  if ((tickCount > 20) && (++tickCount % 7 === 0)) {
    var xrange = d3.extent(graph.nodes.map(n => n.x));
    var yrange = d3.extent(graph.nodes.map(n => n.y));
    var vbx = xrange[0] - dim.margin;
    var vby = yrange[0] - dim.margin;
    var vbw = xrange[1] - xrange[0] + 2 * dim.margin;
    var vbh = yrange[1] - yrange[0] + 2 * dim.margin;
    var vb = `${vbx} ${vby} ${vbw} ${vbh}`;
    svg.attr('viewBox', vb);
  }
  
  // move labels to follow nodes
  labels.forEach(l => {
    l.text.attr('x', l.node.x);
    l.text.attr('y', l.node.y + 4);
  });

}

// default drag handlers
function dragstarted(d) {
  if (!d3.event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(d) {
  d.fx = d3.event.x;
  d.fy = d3.event.y;
}

function dragended(d) {
  if (!d3.event.active) simulation.alphaTarget(0);
  if (d.type !== 'goal') {
    d.fx = null;
    d.fy = null;
  }
}
 