'use client';

import { useRef } from 'react';
import { deactivatePatient } from '@/app/(app)/actions';

export function DeactivateDialog(props: {
  id: string;
  label: string;
  title: string;
  text: string;
  reasonLabel: string;
  reasonPlaceholder: string;
  cancel: string;
  confirm: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="btn btn--danger" onClick={() => ref.current?.showModal()}>
        {props.label}
      </button>
      <dialog ref={ref} className="modal" aria-labelledby="deact-h">
        <form action={deactivatePatient}>
          <input type="hidden" name="id" value={props.id} />
          <h2 id="deact-h">{props.title}</h2>
          <div className="body">
            <p>{props.text}</p>
            <div className="f">
              <label className="l" htmlFor="reason">
                {props.reasonLabel}
              </label>
              <input className="inp" id="reason" name="reason" maxLength={300} placeholder={props.reasonPlaceholder} />
            </div>
          </div>
          <footer>
            <button type="button" className="btn btn--ghost" onClick={() => ref.current?.close()}>
              {props.cancel}
            </button>
            <button className="btn btn--danger solid">{props.confirm}</button>
          </footer>
        </form>
      </dialog>
    </>
  );
}
