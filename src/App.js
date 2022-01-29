import "./App.css";
import data from "./data";
import { countBy, intersection, map, max, uniq } from "lodash";
import { useEffect, useRef, useState } from "react";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { makeStyles } from "@material-ui/core/styles";
import { Grid, Paper, Slider, Typography } from "@material-ui/core";
import Plot from "react-plotly.js";
import chroma from "chroma-js";
import cytoscape from "cytoscape";
import UUID from "uuidjs";
import popper from "cytoscape-popper";
import tippy from "tippy.js";

cytoscape.use(popper);

const COLORSCALE = chroma
    .scale("Spectral")
    .mode("lch")
    .domain([0, 1]);

const useStyles = makeStyles((theme) => ({
  content: {
    flexGrow: 1,
    height: "100vh",
    overflow: "auto",
    margin: "10px",
  },
  cy: {
    height: "100%",
    width: "100%",
  },
  item: {
    ...theme.typography.body2,
    padding: theme.spacing(1),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
  box: {
    width: "100%",
    height: "90vh",
    backgroundColor: "primary.dark",
  },
  table: {
    'border-collapse':'collapse',
    'border-spacing':0,
    'border-color':'#AAAAAA',
    'border-style':'solid',
    'border-width':'1px',
    // 'font-weight':'normal',
    fontFamily:'Arial, sans-serif',
    fontSize:'16px',
    overflow:'hidden',
    margin: 10,
    wordBreak:'normal',
    textAlign:'center',
    verticalAlign:'top',
    position: 'absolute',
    backgroundColor: 'white',
  },
  tableCell: {
    paddingInlineStart: 5,
    paddingInlineEnd: 5,
  }
}));

const initialSliderVal = 0;

function App() {
  const styles = useStyles();
  const [itemsetSize, setItemsetSize] = useState(2);
  const [filteredData, setFilteredData] = useState(data);
  const [minSupport, setMinSupport] = useState(initialSliderVal);
  const [binCount, setBinCount] = useState({});
  const [selectedItemsetId, setSelectedItemsetId] = useState([]);
  const [style, setStyle] = useState([]);
  const cyRef = useRef();

  const itemsetSizes = uniq(data.map((elem) => elem.items.length)).sort();

  useEffect(() => {
    if (cyRef.current) {
      if (selectedItemsetId && selectedItemsetId.length > 0) {
        const newStyle = [
          ...style,
          {
            selector: "node",
            style: {
              opacity: (elem) =>
                intersection(selectedItemsetId, elem.attr("itemsets")).length >
                0
                  ? 1
                  : 0.3,
            },
          },
          {
            selector: "edge",
            style: {
              opacity: (elem) =>
                selectedItemsetId.includes(elem.attr("itemsetID")) ? 1 : 0.1,
            },
          },
        ];
        cyRef.current.style(newStyle).update();
      } else {
        cyRef.current.style(style).update();
      }
    }
  }, [style, selectedItemsetId]);

  useEffect(() => {
    setFilteredData(
      data
        .filter((elem) => elem.items.length === itemsetSize)
        .filter((elem) => elem.support >= minSupport)
    );
    setSelectedItemsetId([]);
  }, [itemsetSize, minSupport]);

  useEffect(() => {
    if (filteredData && filteredData.length > 0) {
      setBinCount(
        countBy(filteredData, (elem) => Math.floor(elem.support * 10))
      );

      const newStyle = [
        {
          selector: "node",
          style: {
            "background-color": "#0054FF",
            "background-height": "40%",
            "background-width": "40%",
            "border-color": "#fff",
            "border-width": "2%",
            color: "#000",
            // width: 20,
            // height: 20,
            width: (elem) => elem.attr("numOfItemsets") * 2 + 10,
            height: (elem) => elem.attr("numOfItemsets") * 2 + 10,
            shape: "ellipse",
            label: "data(id)",
            "font-family": "Helvetica",
            "font-size": 12,
            "min-zoomed-font-size": 8,
            "overlay-opacity": 0,
          },
        },
        {
          selector: "edge",
          style: {
            "line-color": (elem) => elem.attr("color"),
            width: 4,
            opacity: 1,
            "overlay-opacity": 0,
            "source-arrow-shape": "none",
            "target-arrow-shape": "none",
            // "target-arrow-shape": "triangle",
            // "target-arrow-color": "#999",
            "curve-style": "bezier",
          },
        },
      ];
      setStyle(newStyle);

      const getNodes = (data) => {
        const classes = uniq(data.flatMap((row) => row.items).sort());
        return classes.map((item) => {
          return {
            data: {
              id: item,
              itemsets: filteredData
                  .filter((elem) => elem.items.includes(item))
                  .map((elem) => elem.id),
              numOfItemsets: filteredData.filter((elem) =>
                  elem.items.includes(item)
              ).length,
            },
          };
        });
      };
      const nodes = getNodes(filteredData);
      const edges = filteredData.flatMap((row) => {
        return row.items.flatMap((src, i) => {
          if (i === row.items.length - 1) {
            if (row.items.length > 2) {
              return {
                data: {
                  id: UUID.generate(),
                  itemsetID: row.id,
                  source: src,
                  target: row.items[0],
                  support: row.support,
                  count: row.count,
                  items: row.items,
                  color: COLORSCALE(row.support).hex(),
                },
              };
            }
          } else {
            return {
              data: {
                id: UUID.generate(),
                itemsetID: row.id,
                source: src,
                target: row.items[i + 1],
                support: row.support,
                count: row.count,
                items: row.items,
                color: COLORSCALE(row.support).hex(),
              },
            };
          }
        }).filter((item) => item);
      });
      console.log(nodes, edges);
      const layout = {
        name: "circle",

        fit: true, // whether to fit the viewport to the graph
        padding: 30, // the padding on fit
        boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
        avoidOverlap: true, // prevents node overlap, may overflow boundingBox and radius if not enough space
        nodeDimensionsIncludeLabels: false, // Excludes the label when calculating node bounding boxes for the layout algorithm
        spacingFactor: undefined, // Applies a multiplicative factor (>0) to expand or compress the overall area that the nodes take up
        radius: undefined, // the radius of the circle
        startAngle: (3 / 2) * Math.PI, // where nodes start in radians
        sweep: undefined, // how many radians should be between the first and last node (defaults to full circle)
        clockwise: true, // whether the layout should go clockwise (true) or counterclockwise/anticlockwise (false)
        sort: undefined, // a sorting function to order the nodes; e.g. function(a, b){ return a.data('weight') - b.data('weight') }
        animate: false, // whether to transition the node positions
        animationDuration: 500, // duration of animation in ms if enabled
        animationEasing: undefined, // easing of animation if enabled
        animateFilter: function (node, i) {
          return true;
        }, // a function that determines whether the node should be animated.  All nodes animated by default on animate enabled.  Non-animated nodes are positioned immediately when the layout starts
        ready: undefined, // callback on layoutready
        stop: undefined, // callback on layoutstop
        transform: function (node, position) {
          return position;
        }, // transform a given node position. Useful for changing flow direction in discrete layouts
      };

      // render graph
      const cy = cytoscape({
        container: document.getElementById("cy"), // container to render in
        elements: [...nodes, ...edges],
        style: style,
        layout: layout,
      });
      cyRef.current = cy;

      // on hover, show itemset members and support
      cy.on("mouseover", "edge", (evt) => {
        const popper = evt.target.popperRef();
        const div = document.createElement("div");
        const tip = new tippy(div, {
          getReferenceClientRect: popper.getBoundingClientRect, // https://atomiks.github.io/tippyjs/v6/all-props/#getreferenceclientrect
          trigger: "manual", // mandatory, we cause the tippy to show programmatically.
          // content prop can be used when the target is a single element https://atomiks.github.io/tippyjs/v6/constructor/#prop
          content: () => {
            div.classList.add("popper");
            div.innerHTML =
              `Support: ${evt.target._private.data.support.toFixed(
                4
              )}</br>Itemset:</br>` +
              evt.target._private.data.items
                .map((itemid) => `- ${itemid}</br>`)
                .join("");
            document.body.appendChild(div);
            return div;
          },
          placement: "right",
          offset: [0, 15],
        });
        tip.show();
        evt.target.on("mouseout", () => {
          tip.hide();
        });
      });

      // highlight itemset when an edge is clicked
      cy.on("tapstart", "edge", (evt) => {
        if (evt.target && evt.target._private.data.itemsetID) {
          console.log(evt.target._private.data);
          // add to or remove from selectedItemsetId
          // if (selectedItemsetId.includes(evt.target._private.data.itemsetID)) {
          //   setSelectedItemsetId(selectedItemsetId.filter((itemsetID) => itemsetID !== evt.target._private.data.itemsetID))
          // } else {
          //   setSelectedItemsetId([...selectedItemsetId, evt.target._private.data.itemsetID])
          // }
          setSelectedItemsetId([evt.target._private.data.itemsetID]);
        }
      });
      cy.on("tapstart", "node", (evt) => {
        setSelectedItemsetId(
          filteredData
            .filter((elem) => elem.items.includes(evt.target._private.data.id))
            .map((elem) => elem.id)
        );
      });
      // clear
      cy.on("tapstart", (evt) => {
        if (!evt.target._private.data.id) setSelectedItemsetId([]);
      });
    }
  }, [filteredData]);

  const arr = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]
  arr.reverse()

  return (
    <div className={styles.content}>
      <Typography variant={"h4"} component={"p"} gutterBottom>
        MCOMP Frequent Itemset and Support
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={5} direction={"column"}>
          <Paper className={styles.item}>
            <FormControl style={{ width: "10%" }}>
              <InputLabel>Itemset Size</InputLabel>
              <Select
                value={itemsetSize}
                label="Itemset size"
                onChange={(e) => {
                  setItemsetSize(parseInt(e.target.value));
                }}
              >
                {itemsetSizes.sort().map((elem) => (
                  <MenuItem value={String(elem)} key={String(elem)}>
                    {elem}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <InputLabel>Minimum Support Value</InputLabel>
            <Slider
              aria-label="Minimum support"
              defaultValue={initialSliderVal}
              min={0}
              max={1}
              step={0.01}
              valueLabelDisplay="on"
              onChange={(e) => setMinSupport(parseFloat(e.target.textContent))}
              style={{ width: "80%", marginLeft: "10%", marginRight: "10%" }}
            />
            <Plot
              data={[
                {
                  type: "bar",
                  orientation: "v",
                  x: Object.keys(binCount).map((item) => parseInt(item) / 10),
                  y: Object.values(binCount),
                },
              ]}
              layout={{
                title: "Itemset count by Support",
                xaxis: { title: "Support" },
                yaxis: { title: "Count" },
              }}
            />
          </Paper>
        </Grid>
        <Grid item xs={7} sx={{ height: "100vh" }}>
          <Paper className={styles.box}>
            <table className={styles.table}>
              <thead>
              <tr>
                <th />
                <th style={{textAlign:'center', padding: '5px 5px 5px 5px'}}>Support</th>
              </tr>
              </thead>
              <tbody>
              {
                arr.map((val) => (
                    <tr>
                      <td className={styles.tableCell}><div style={{width: '20px', height: '20px', backgroundColor: COLORSCALE(val).hex(), borderRadius: '10px'}}/></td>
                      <td className={styles.tableCell}> {val} </td>
                    </tr>
                ))
              }
              </tbody>
            </table>
            <div className={styles.cy} id={"cy"} />
          </Paper>
        </Grid>
      </Grid>
    </div>
  );
}

export default App;
