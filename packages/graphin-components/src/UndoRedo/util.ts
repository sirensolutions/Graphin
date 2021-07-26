import type { Graph } from '@antv/g6';

/**
 * 缩放画布
 * @param isRelative
 * @param graph
 * @param value
 * @param center
 */
export const zoomCanvas = (
    isRelative: boolean,
    graph: Graph,
    value: number,
    center?: { x: number; y: number },
    notEmit?: boolean,
  ) => {
    // 可传入centerPoint（例如coreNode等），如果没传 默认取group的中心点的canvas坐标
    let centerPoint = center;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    if (!centerPoint) {
      centerPoint = { x: 0, y: 0 };
      graph.getNodes().forEach(node => {
        const { x, y } = node.getModel();
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      });
      centerPoint.x = (minX + maxX) / 2;
      centerPoint.y = (minY + maxY) / 2;
    }
    const canvasPoint = graph.getCanvasByPoint(centerPoint.x, centerPoint.y);
  
    const maxZoom = graph.get('maxZoom');
    const minZoom = graph.get('minZoom');
    const originZoom = graph.getZoom();
    const targetZoom = isRelative ? originZoom * value : value;
    const zoom = targetZoom > maxZoom ? maxZoom : targetZoom < minZoom ? minZoom : targetZoom;
  
    graph.setAutoPaint(false);
    graph.zoom(zoom / originZoom, canvasPoint);
    graph.paint();
    graph.setAutoPaint(true);
  
    if (!notEmit) {
      graph.emit('wheelzoom', { zoomData: { zoom, originZoom, center: centerPoint } });
    }
  };