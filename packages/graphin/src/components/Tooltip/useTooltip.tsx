import React, { useEffect, useRef } from 'react';
import { GraphinContext, IG6GraphEvent } from '../../index';

export interface State {
  /** 当前状态 */
  visible: boolean;
  x: number;
  y: number;
  /** 触发的元素 */
  item?: IG6GraphEvent['item'];
}

export interface Props {
  bindType: 'node' | 'edge';
  container: React.RefObject<HTMLDivElement>;
  delay?: {
    show?: number;
    hide?: number;
  }
}
// let timer.current: number | undefined;

const useTooltip = (props: Props) => {
  const { bindType = 'node', container } = props;
  const graphin = React.useContext(GraphinContext);
  const { graph } = graphin;

  const timer = useRef<number>();

  const [state, setState] = React.useState<State>({
    visible: false,
    x: 0,
    y: 0,
    item: null,
  });

  const handleShow = (e: IG6GraphEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (timer.current) {
      window.clearTimeout(timer.current);
    }

    const point = graph.getPointByClient(e.clientX, e.clientY);
    let { x, y } = graph.getCanvasByPoint(point.x, point.y);
    if (bindType === 'node') {
      // 如果是节点，则x，y指定到节点的中心点
      // eslint-disable-next-line no-underscore-dangle
      if (e.item) {
        const { x: PointX = 0, y: PointY = 0 } = e.item.getModel();
        const CenterCanvas = graph.getCanvasByPoint(PointX, PointY);

        const daltX = e.canvasX - CenterCanvas.x;
        const daltY = e.canvasY - CenterCanvas.y;
        x = x - daltX;
        y = y - daltY;
      }
    }

    /** 设置变量 */
    timer.current = window.setTimeout(() => {
      setState(preState => {
        return {
          ...preState,
          visible: true,
          item: e.item,
          x,
          y,
        };
      });
    }, props?.delay?.show || 0);
  };
  const handleClose = () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
    }
    timer.current = window.setTimeout(() => {
      setState(preState => {
        return {
          ...preState,
          visible: false,
          item: null,
          x: 0,
          y: 0,
        };
      });
    }, props?.delay?.hide || 200);
  };
  const handleDragStart = () => {
    setState({
      ...state,
      visible: false,
      x: 0,
      y: 0,
      item: null,
    });
  };
  const handleDragEnd = (e: IG6GraphEvent) => {
    const point = graph.getPointByClient(e.clientX, e.clientY);
    let { x, y } = graph.getCanvasByPoint(point.x, point.y);
    if (bindType === 'node') {
      // 如果是节点，则x，y指定到节点的中心点
      // eslint-disable-next-line no-underscore-dangle
      if (e.item) {
        const { x: PointX = 0, y: PointY = 0 } = e.item.getModel();
        const CenterCanvas = graph.getCanvasByPoint(PointX, PointY);

        const daltX = e.canvasX - CenterCanvas.x;
        const daltY = e.canvasY - CenterCanvas.y;
        x = x - daltX;
        y = y - daltY;
      }
      setState({
        ...state,
        visible: true,
        x,
        y,
        item: e.item,
      });
    }
  };
  const removeTimer = () => {
    clearTimeout(timer.current);
  };
  useEffect(() => {
    graph.on(`${bindType}:mouseenter`, handleShow);
    graph.on(`${bindType}:mouseleave`, handleClose);
    graph.on(`afterremoveitem`, handleClose);
    graph.on(`node:dragstart`, handleDragStart);
    graph.on(`node:dragend`, handleDragEnd);
    // graph.on(`${bindType}:mousemove`, handleUpdatePosition);

    container.current?.addEventListener('mouseenter', removeTimer);
    container.current?.addEventListener('mouseleave', handleClose);

    return () => {
      console.log('effect..remove....');
      graph.off(`${bindType}:mouseenter`, handleShow);
      graph.off(`${bindType}:mouseleave`, handleClose);
      graph.off(`afterremoveitem`, handleClose);
      graph.off(`node:dragstart`, handleDragStart);
      graph.off(`node:dragend`, handleDragEnd);
      container.current?.removeEventListener('mouseenter', removeTimer);
      container.current?.removeEventListener('mouseleave', handleClose);
      // graph.off(`${bindType}:mousemove`, handleUpdatePosition);
    };
  }, []);

  return {
    ...state,
  };
};

export default useTooltip;
