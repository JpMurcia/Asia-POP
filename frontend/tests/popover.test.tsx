import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import Popover from '../src/pages/TemplateEditor/Popover';

/** Feature 009: el panel anclado que usan los selectores de color y de fuente. */
function Harness({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <div>
      <button ref={setAnchor} type="button" onClick={() => setOpen((o) => !o)}>
        Abrir
      </button>
      <button type="button">Fuera</button>
      <Popover
        open={open}
        anchor={anchor}
        title="Color: Relleno"
        onClose={() => {
          onClose();
          setOpen(false);
        }}
      >
        <input data-autofocus aria-label="Buscar" />
        <button type="button">Dentro</button>
      </Popover>
    </div>
  );
}

const open = () => fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
const dialog = () => screen.queryByRole('dialog', { name: 'Color: Relleno' });

describe('Popover', () => {
  it('no se muestra cerrado y al abrirse lleva el foco al campo marcado', () => {
    render(<Harness />);
    expect(dialog()).toBeNull();
    open();
    expect(dialog()).toBeInTheDocument();
    expect(screen.getByLabelText('Buscar')).toHaveFocus();
  });

  it('Escape lo cierra y devuelve el foco al control que lo abrió', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    open();
    fireEvent.keyDown(screen.getByLabelText('Buscar'), { key: 'Escape' });
    expect(dialog()).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus();
  });

  it('el Escape del panel no llega a los atajos del editor', () => {
    const outside = vi.fn();
    window.addEventListener('keydown', outside);
    render(<Harness />);
    open();
    fireEvent.keyDown(screen.getByLabelText('Buscar'), { key: 'Escape' });
    window.removeEventListener('keydown', outside);
    expect(outside).not.toHaveBeenCalled();
  });

  it('el botón «Cerrar» lo cierra y devuelve el foco', () => {
    render(<Harness />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(dialog()).toBeNull();
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus();
  });

  it('un clic fuera lo cierra, pero no se cierra al hacer clic dentro', () => {
    render(<Harness />);
    open();
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Dentro' }));
    expect(dialog()).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Fuera' }));
    expect(dialog()).toBeNull();
  });

  it('se coloca junto al control con posición fija', () => {
    render(<Harness />);
    open();
    const style = dialog()!.style;
    expect(style.width).toBe('300px');
    expect(style.left).not.toBe('');
    expect(style.top).not.toBe('');
  });
});
