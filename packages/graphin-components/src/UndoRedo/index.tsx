import React, { Component } from 'react';
import { GraphinContext } from '@antv/graphin';
import { debounce } from '@antv/util';
import HistoryController from './history';
// import { processGraphState } from '../../../graph/utils/util';
import type { GraphHistoryState } from './types';
import { HistoryStackType } from './types';

interface UndoRedoProps {
  maxUndoStep?: number; // 最大撤回步数
  maxRedoStep?: number; // 最大重做步数
  setBizData?: () => void; // 设置业务数据的回调
}

interface UndoRedoState {
  historyStack: {
    undoStack: GraphHistoryState[];
    redoStack: GraphHistoryState[];
  };
}


export default class UndoRedo extends Component<Readonly<UndoRedoProps>, UndoRedoState> {
  history: HistoryController;

  GraphEvents = [
    /** node */
    'node:dragstart',
    'node:dragend',
    'node:toggle',

    /** canvas */
    'canvas:dragendfinal',
    'wheelzoom',

    /** data */
    'afterchangedata',
    'data:stackpop',
    'data:needchange',

    /** state */
    'graphstatechange',
    'state:stackpop',

    /** history */
    'history:stackchange',

    /** layout */
    'layout:stackpop',
    'layout:afterchange',

    /** other */
    'mouseup',
  ];

  FrequentEvents = ['wheelzoom', 'mouseup'];

  eventHanlerMap: Record<string, (e) => void> = {};

  constructor (props) {
    super(props);
    this.state = {
      historyStack: {
       undoStack: [],
       redoStack: [],
     },
   };
  }
  

  componentDidMount() {
    const { dispatch } = this.context;

    this.GraphEvents.forEach(graphEvent => {
      switch (graphEvent) {
        case 'node:dragstart':
          this.bindCustomEventHandler(graphEvent, () => {
            const { data } = this.context;
            this.history?.saveGraphData(data);
          });
          break;
        case 'node:dragend':
          this.bindCustomEventHandler(graphEvent, e => {
            this.handleSaveHistory(graphEvent, e);
          });
          break;
        case 'afterchangedata':
          this.bindCustomEventHandler(graphEvent, e => {
            const { historyState, graph, data } = this.context;
            if (!e.isLayoutChange && !historyState.dataChangeFromHistory) {
              this.handleSaveHistory(graphEvent, e);
            }
            this.history?.saveGraphData(data);
            // processGraphState(graph);
            dispatch({
              historyState: {
                ...historyState,
                dataChangeFromHistory: false,
              },
            });
          });
          break;
        case 'node:toggle':
        case 'wheelzoom':
        case 'canvas:dragendfinal':
          this.bindCustomEventHandler(graphEvent, e => {
            this.handleSaveHistory(graphEvent, e);
          });
          break;
        case 'graphstatechange':
          this.bindCustomEventHandler(graphEvent, e => {
            const { historyState, graph } = this.context;
            if (!historyState.statesChangeFromHistory) {
              this.handleSaveHistory(graphEvent, e);
            }
            this.history?.saveGraphStates(graph);
            dispatch({
              historyState: {
                ...historyState,
                statesChangeFromHistory: false,
              },
            });
          });
          break;
        case 'layout:afterchange':
          this.bindCustomEventHandler(graphEvent, e => {
            const { historyState } = this.context;
            if (!historyState.layoutChangeFromHistory) {
              this.handleSaveHistory(graphEvent, e);
            }
            dispatch({
              historyState: {
                ...historyState,
                layoutChangeFromHistory: false,
              },
            });
          });
          break;
        case 'layout:stackpop':
          this.bindCustomEventHandler(graphEvent, e => {
            const { layout, historyState } = this.context;
            this.history?.saveLayout(layout);
            dispatch({
              layout: e.layout,
              historyState: {
                ...historyState,
                layoutChangeFromHistory: true,
              },
            });
          });
          break;
        case 'data:stackpop':
          this.bindCustomEventHandler(graphEvent, e => {
            const { historyState, graph, data } = this.context;
            dispatch({
              data: e.graphData,
              historyState: {
                ...historyState,
                dataChangeFromHistory: true,
              },
            });
            this.history?.saveGraphData(data);
            graph.emit('data:needchange', e);
          });
          break;
        case 'state:stackpop':
          this.bindCustomEventHandler(graphEvent, () => {
            const { historyState } = this.context;
            dispatch({
              historyState: {
                ...historyState,
                statesChangeFromHistory: true,
              },
            });
          });
          break;
        case 'mouseup':
          this.bindCustomEventHandler(graphEvent, () => {
            const { data } = this.context;
            this.history?.saveGraphData(data);
          });
          break;
        case 'history:stackchange':
          this.bindCustomEventHandler(graphEvent, ({ undoStack, redoStack }) => {
            this.setState({
              historyStack: {
                undoStack,
                redoStack,
              },
            });
          });
          break;
        default:
          break;
      }
    });
  }

  componentWillUnmount() {
    const { graph } = this.context;
    Object.keys(this.eventHanlerMap)?.forEach(eventName => {
      graph?.off(eventName, this.eventHanlerMap[eventName]);
    });
  }

  handleSaveHistory = async (action, actionData) => {
    const { graph } = this.context;
    const { maxUndoStep, maxRedoStep, setBizData } = this.props;
    if (!this.history) {
      this.history = await new HistoryController(graph, maxUndoStep, maxRedoStep);
      if (setBizData) {
        setBizData();
      }
    } else {
      this.history.updateGraph(graph);
    }
    this.history.updateHistoryStack(action, actionData, HistoryStackType.undo);
  };

  handelUndo = () => {
    const { historyStack } = this.state;
    console.log(historyStack);
    this.history?.undo();
  };

  handelRedo = () => {
    this.history?.redo();
  };

  bindCustomEventHandler(eventName, callback) {
    const { graph } = this.context;
    const handler = e => {
      const debounceTime = 50;
      let wrappedCallback = event => {
        if (callback) {
          callback(event);
        }
        // 每次会调设置当前触发的事件
        this.history?.setPrevAction(eventName);
      };
      if (this.FrequentEvents.includes(eventName)) {
        wrappedCallback = debounce(wrappedCallback, debounceTime);
      }
      wrappedCallback(e);
    };
    graph.on(eventName, handler);
    this.eventHanlerMap[eventName] = handler;
  }

  render() {
    return (
      <>
      </>
    );
  }
}


UndoRedo.contextType = GraphinContext;
// @ts-ignore
UndoRedo.defaultProps = {
  maxUndoStep: 5,
  maxRedoStep: 5,
}
