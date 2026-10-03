import {Button, Flex} from '@sanity/ui'
import type {LayoutProps, ToolMenuProps} from 'sanity'

import {ADVANCED, setAdvanced} from './advanced'

/** Tool tabs + the "Advanced mode" switch, in the top bar and in the phone drawer. */
export function ToolMenu(props: ToolMenuProps) {
  return (
    <Flex align={props.context === 'sidebar' ? 'stretch' : 'center'} direction={props.context === 'sidebar' ? 'column' : 'row'} gap={2}>
      {props.renderDefault(props)}
      <Button
        fontSize={1}
        padding={2}
        mode={ADVANCED ? 'default' : 'ghost'}
        tone={ADVANCED ? 'primary' : 'default'}
        text={ADVANCED ? 'Розширений режим: увімк.' : 'Розширений режим'}
        title={
          ADVANCED
            ? 'Вимкнути: сховати релізи, планування, коментарі, завдання, Canvas і рекламу тарифів'
            : 'Увімкнути всі функції Sanity: релізи, планування, коментарі, завдання, Vision, англійська мова'
        }
        onClick={() => setAdvanced(!ADVANCED)}
      />
    </Flex>
  )
}

/**
 * Hides Sanity's trial / "upgrade" button in the top bar (there is no config
 * switch for it) unless advanced mode is on.
 */
export function Layout(props: LayoutProps) {
  return (
    <>
      {!ADVANCED && (
        <style>{`[data-testid="studio-navbar"] button:has([data-sanity-icon="bolt"]){display:none!important}`}</style>
      )}
      {props.renderDefault(props)}
    </>
  )
}
