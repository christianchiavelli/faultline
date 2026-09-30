import { depthClassOf, isDepthClass } from './depth';

describe('depthClassOf', () => {
  it('classes a depth as shallow, intermediate or deep, each bound starting the next class', () => {
    expect(depthClassOf(10)).toBe('shallow');
    expect(depthClassOf(69.9)).toBe('shallow');
    expect(depthClassOf(70)).toBe('intermediate');
    expect(depthClassOf(299.9)).toBe('intermediate');
    expect(depthClassOf(300)).toBe('deep');
    expect(depthClassOf(662)).toBe('deep');
  });

  it('counts an event above sea level as shallow, and leaves one without a depth unclassed', () => {
    expect(depthClassOf(-1.2)).toBe('shallow');
    expect(depthClassOf(null)).toBeNull();
  });

  it('knows its own class names', () => {
    expect(isDepthClass('deep')).toBe(true);
    expect(isDepthClass('mantle')).toBe(false);
  });
});
