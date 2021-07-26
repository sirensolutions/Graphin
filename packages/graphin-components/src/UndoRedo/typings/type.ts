import { GraphData } from '@antv/g6';
import { PlainObject } from '@antv/graphin';
import { MAPPED_GRAPH_STATES } from '../../../../graph/constants';


export enum HistoryStackType {
  undo = 'undo',
  redo = 'redo',
}

export interface GraphHistoryState {
  action: string;
  data: {
    graphData: GraphData;
    actionData: PlainObject;
    bizData: PlainObject;
    graphStates: MAPPED_GRAPH_STATES[];
  };
}

export interface LayoutItem {
  id: string;
  name: string;
  displayName: string;
  options?: {
    [key: string]: any;
  };
}

export interface MAPPED_GRAPH_STATES {
  id: string;
  states: ITEM_STATE[];
}

export enum ITEM_STATE {
  Active = 'active',
  Default = 'default',
  Selected = 'selected',
  Disable = 'disable',
  Highlight = 'highlight',
  Inactive = 'inactive',
}


