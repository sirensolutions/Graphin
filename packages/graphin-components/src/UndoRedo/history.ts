import { Graph, GraphData } from '@antv/g6';
import { INode, IItemBase } from '@antv/g6/lib/interface/item';
import { PlainObject  } from '@antv/graphin';
import { cloneDeep } from 'lodash-es/cloneDeep';
import { GraphHistoryState, HistoryStackType, LayoutItem } from './typings/type';
import { zoomCanvas } from './util';
import { paintOnce, setItemState, resetBaseStates } from '../../../graph/utils/graph';
import { ITEM_STATE, MAPPED_GRAPH_STATES } from '../../../graph/constants';

export default class HistoryController {
  private graph: Graph; // G6实例

  private graphData: GraphData; // 图数据

  private layout: LayoutItem; // 图布局数据

  private graphStates: MAPPED_GRAPH_STATES[]; // 图状态

  private undoStack: Array<GraphHistoryState>; // 撤回栈

  private redoStack: Array<GraphHistoryState>; // 重做栈

  private current: GraphHistoryState; // 当前state

  private lastState: GraphHistoryState; // 上一次state

  private bizData: PlainObject | null; // 业务数据

  private prevAction: string = ''; // 上一次action

  private preActionTimeStamp: number = 0; // 记录上一次action触发的时间 用于兼容node:drag过程中频繁触发mouseleave或者mouseenter导致连续的drag会多次记录

  private frequentAction: string[]; // 自定义的会频繁触发的action

  private maxUndoStep: number = 10; // 最大撤回步数

  private maxRedoStep: number = 10; // 最大重做步数

  // 内部事件 不是由用户直接触发的事件
  private innerActions: string[] = [
    'afterchangedata',
    'graphstatechange',
    'history:stackchange',
    'layout:stackpop',
    'layout:afterchange',
  ];

  // 定义哪些事件需要更新states
  private shouldUpdateStateActions: string[] = [
    'node:click',
    'edge:click',
    'canvas:click',
    'node:dbclick',
    'mouseup',
  ];

  constructor(graph, maxUndoStep, maxRedoStep) {
    this.graph = graph;
    this.maxUndoStep = maxUndoStep;
    this.maxRedoStep = maxRedoStep;
    this.undoStack = [];
    this.redoStack = [];
    this.bizData = null;
    this.frequentAction = ['wheelzoom', 'node:drag'];
    this.current = null;
    this.graphData = {
      nodes: [],
      edges: [],
    };
    this.layout = null;
  }

  public updateGraph = (graph: Graph) => {
    this.graph = graph;
  };

  /**
   * 数据入栈
   * @param action
   * @param actionData
   * @param stackType
   */

  private pushStack = (
    action: string,
    actionData: PlainObject,
    stackType: HistoryStackType,
    changeFromHistory: boolean = false,
  ) => {
    const current = {
      action,
      data: {
        graphData: cloneDeep(this.graphData),
        actionData: cloneDeep(actionData),
        bizData: this.bizData,
        graphStates: this.graphStates,
      },
    };
    const stack = stackType === HistoryStackType.redo ? this.redoStack : this.undoStack;
    if (changeFromHistory || this.shouldPushStack(action)) {
      const maxStep = stackType === HistoryStackType.redo ? this.maxRedoStep : this.maxUndoStep;
      if (stack.length < maxStep) {
        stack.push(current);
      } else {
        stack.splice(0, 1);
        stack.push(current);
      }
    } else {
      if (stack.length === 0) {
        return;
      }
      stack.pop();
      stack.push(current);
    }
    this.current = current;
    this.setPrevAction(action);
    this.graph.emit('history:stackchange', {
      current,
      undoStack: this.undoStack,
      redoStack: this.redoStack,
    });
  };

  /**
   * undo 操作
   */
  public undo = () => {
    this.handleUndoRedo(HistoryStackType.undo);
  };

  /**
   * redo 操作
   */
  public redo = () => {
    this.handleUndoRedo(HistoryStackType.redo);
  };

  private handleUndoRedo = (type: HistoryStackType) => {
    const stack = type === HistoryStackType.redo ? this.redoStack : this.undoStack;
    if (stack.length === 0) {
      return;
    }
    const originZoom = this.graph.getZoom();
    const state = stack.pop();
    this.lastState = state;
    this.handleAction(state, type);
    if (state) {
      const {
        action,
        data: { actionData },
      } = state;
      // 将state压入另一个栈
      const stackType =
        type === HistoryStackType.redo ? HistoryStackType.undo : HistoryStackType.redo;

      this.pushStack(
        action,
        {
          ...actionData,
          dx: -actionData?.dx,
          dy: -actionData?.dy,
          layout: this.layout,
          zoomData: {
            ...actionData?.zoomData,
            originZoom,
          },
          folded: !actionData?.folded,
        },
        stackType,
        true,
      );
    }
    this.resetPrevAction();
  };

  /**
   * 具体事件处理
   * @param state
   */
  private handleAction = (state: GraphHistoryState, type: HistoryStackType) => {
    const {
      action,
      data: { actionData, graphData, graphStates, bizData },
    } = state;
    const { nodeId, folded } = actionData;

    switch (action) {
      /* 单纯画布操作--start */
      case 'canvas:dragendfinal':
        this.graph.translate(-actionData?.dx, -actionData?.dy);
        this.graph.paint();
        break;
      case 'wheelzoom':
        zoomCanvas(
          false,
          this.graph,
          actionData?.zoomData?.originZoom,
          actionData?.zoomData?.center,
          true,
        );
        break;
      case 'layout:afterchange':
        this.graph.emit('layout:stackpop', { layout: actionData?.layout });
        break;
      /* 单纯画布操作--end */

      case 'afterchangedata':
        this.graph.emit('data:stackpop', {
          onlyPosition: false,
          graphData,
          bizData,
          type,
        });
        break;
      case 'node:dragend':
        this.graph.emit('data:stackpop', {
          onlyPosition: true,
          graphData,
          bizData,
        });
        break;
      case 'node:toggle':
        if (nodeId) {
          const targetNode = this.graph.findById(nodeId) as INode;
          this.graph.updateItem(targetNode, {
            folded: !folded,
          });
          Utils.toggle(this.graph, actionData?.nodeId, true);
        }
        break;
      case 'graphstatechange':
        this.graph.emit('state:stackpop');
        this.setStatesFromHistory(this.graph, graphStates);
        break;
      default:
        break;
    }
  };

  /**
   * 判断是否应该直接执行推栈操作
   */
  private shouldPushStack(action: string) {
    if (this.frequentAction.includes(action)) {
      if (this.prevAction === action || Date.now() - this.preActionTimeStamp < 100) {
        return false;
      }
      return true;
    }
    return true;
  }

  // 获取undoStack
  public getUndoStack = () => this.undoStack;

  // 获取redoStack
  public getRedoStack = () => this.redoStack;

  // 获取current
  public getCurrent = () => this.current;

  // lastState
  public getLastState = () => this.lastState;

  // 获取graphData
  public getGraphData = () => this.graphData;

  // 只有自定义事件需要将事件记录
  private shouldSetPrevAction = (actionName: string) => {
    this.preActionTimeStamp = Date.now();
    if (this.innerActions.includes(actionName)) {
      return false;
    }
    return true;
  };

  // 设置上一次的action
  public setPrevAction = (actionName: string) => {
    if (this.shouldSetPrevAction(actionName)) {
      this.prevAction = actionName;
    }
  };

  private isSameGraphStates = (): boolean => {
    const { graphStates: formerStates, graph } = this;
    const nodes = graph.get('nodes');
    const edges = graph.get('edges');
    const currentStates = this.sortGraphStates(this.getStatesFromGraph(nodes.concat(edges)));
    const isSame = JSON.stringify(formerStates) === JSON.stringify(currentStates);
    return isSame;
  };

  // states数组排序 方便后面直接通过JSON.stringify进行比较
  private sortGraphStates = (graphStates: MAPPED_GRAPH_STATES[]): MAPPED_GRAPH_STATES[] =>
    graphStates
      // 过滤hover active状态的存储
      .map(node => ({ ...node, states: [...node.states].sort().filter(state => state !== ITEM_STATE.Active) }))
      .sort((pre, next) => +pre.id - +next.id);

  // 从graphData中获取states并且映射成[{id, states}]的形式
  private getStatesFromGraph = (items: IItemBase[]): MAPPED_GRAPH_STATES[] => {
    const mappedStates: MAPPED_GRAPH_STATES[] = [];
    items.forEach(item => {
      const states = item.get('states') as ITEM_STATE[];
      const id = item.get('id');
      mappedStates.push({ id, states });
    });
    return mappedStates;
  };

  // 从栈中获取states并设置到图中
  private setStatesFromHistory = (graph: Graph, states: MAPPED_GRAPH_STATES[]) => {
    // 重置所有节点状态并添加新状态
    resetBaseStates(graph);
    paintOnce(graph, () => {
      states?.forEach(state => {
        const { id, states: itemStates } = state;
        itemStates?.forEach(itemState => {
          setItemState(graph, graph.findById(id), itemState, true);
        });
      });
    });
  };

  // 暴露修改history的方法 针对pushStack的操作做一些必要的判断
  public updateHistoryStack = (
    action: string,
    actionData: PlainObject,
    stackType: HistoryStackType,
    changeFromHistory: boolean = false,
  ) => {
    if (action === 'graphstatechange') {
      if (
        !this.prevAction ||
        !this.shouldUpdateStateActions.includes(this.prevAction) ||
        this.isSameGraphStates()
      ) {
        // 初始化时prevAction为空 和afterchangedata合并 直接return
        // 不满足shouldUpdateStateActions中的事件直接返回
        // 如果graphstatechange之后的states和上一次的states一样 也返回
        return;
      }
    }
    // 初始化时候的afterchangedata不计入history
    if (action === 'afterchangedata' && this.graphData?.nodes?.length === 0) return;
    this.pushStack(action, actionData, stackType, changeFromHistory);
  };

  /**
   * 设置业务数据
   * @param data
   */
  public setBizData = (data: PlainObject) => {
    this.bizData = cloneDeep(data);
  };

  /**
   * 设置graphData
   * @param current
   */
  public saveGraphData = sourceData => {
    const { edges } = sourceData;
    const graphData = this.graph.save() as GraphData;
    let { nodes } = sourceData;

    nodes = nodes.map(node => {
      const graphNode = graphData?.nodes.find(item => item.id === node.id);
      return {
        ...node,
        x: graphNode?.x,
        y: graphNode?.y,
      };
    });

    this.graphData = {
      nodes,
      edges,
    };
  };

  public saveLayout = layout => {
    this.layout = layout;
  };

  // 保存graph的states 只在初始化或者每次重置prevAction或者shouldUpdateStateActions中的某一个事件触发
  public saveGraphStates = (graph: Graph) => {
    const nodes = graph.get('nodes') || [];
    const edges = graph.get('edges') || [];
    if (!this.prevAction || this.shouldUpdateStateActions.includes(this.prevAction)) {
      this.graphStates = cloneDeep(
        this.sortGraphStates(this.getStatesFromGraph(nodes.concat(edges))),
      );
    }
  };

  public resetPrevAction = () => {
    this.prevAction = '';
  };
}
